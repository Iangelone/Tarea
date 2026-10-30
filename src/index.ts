import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadEnvFile } from "node:process";
import { clasificar } from "./clasificador.js";
import { responderChat, type MensajeChat } from "./chat.js";
import { indexarDocumentos } from "./indexador.js";
import { abrirBaseDeDatos, guardarTicket, listarTickets } from "./base-de-datos.js";

// El archivo local es opcional: Docker también puede aportar estas variables.
try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const rutaBase = process.env.DATABASE_PATH || "data/tickets.db";
mkdirSync(dirname(rutaBase), { recursive: true });
const base = abrirBaseDeDatos(rutaBase);

// Recibe solicitudes HTTP para tickets y consultas sobre documentos.
const servidor = createServer(async (solicitud, respuesta) => {
  respuesta.setHeader("Content-Type", "application/json; charset=utf-8");

  // Solo expone los archivos de la interfaz declarados aquí.
  const archivos: Record<string, [string, string]> = {
    "/": ["public/index.html", "text/html; charset=utf-8"],
    "/estilos.css": ["public/estilos.css", "text/css; charset=utf-8"],
    "/app.js": ["public/app.js", "text/javascript; charset=utf-8"],
  };
  const archivo = solicitud.url ? archivos[solicitud.url] : undefined;
  if (solicitud.method === "GET" && archivo) {
    try {
      const contenido = await readFile(archivo[0]);
      respuesta.setHeader("Content-Type", archivo[1]);
      respuesta.end(contenido);
    } catch (error) {
      console.error("No se pudo cargar la interfaz:", error);
      respuesta.writeHead(500);
      respuesta.end(JSON.stringify({ error: "No se pudo cargar la interfaz" }));
    }
    return;
  }

  if (solicitud.method === "GET" && solicitud.url === "/tickets") {
    try {
      respuesta.end(JSON.stringify(listarTickets(base)));
    } catch (error) {
      console.error("Error al consultar tickets:", error);
      respuesta.writeHead(500);
      respuesta.end(JSON.stringify({ error: "No se pudieron consultar los tickets" }));
    }
    return;
  }

  const esChat = solicitud.url === "/chat";
  if (solicitud.method !== "POST" || (solicitud.url !== "/clasificar" && !esChat)) {
    respuesta.writeHead(404);
    respuesta.end(JSON.stringify({ error: "Ruta no encontrada" }));
    return;
  }

  try {
    // Limita el tamaño recibido antes de procesar la solicitud.
    let cuerpo = "";
    for await (const fragmento of solicitud) {
      cuerpo += fragmento;
      if (Buffer.byteLength(cuerpo) > 10_000) {
        respuesta.writeHead(413);
        respuesta.end(JSON.stringify({ error: esChat ? "La pregunta es demasiado larga" : "El reclamo es demasiado largo" }));
        return;
      }
    }

    let datos: unknown;
    try {
      datos = JSON.parse(cuerpo);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      respuesta.writeHead(400);
      respuesta.end(JSON.stringify({ error: "El cuerpo debe ser JSON válido" }));
      return;
    }
    if (esChat) {
      if (typeof datos !== "object" || datos === null || !("pregunta" in datos) || typeof datos.pregunta !== "string" || !datos.pregunta.trim()) {
        respuesta.writeHead(400);
        respuesta.end(JSON.stringify({ error: "Ingresá una pregunta" }));
        return;
      }
      const historial = "historial" in datos ? datos.historial : [];
      if (!Array.isArray(historial) || historial.length > 20 || historial.some((mensaje: unknown) =>
        typeof mensaje !== "object" || mensaje === null || !("role" in mensaje) ||
        (mensaje.role !== "user" && mensaje.role !== "assistant") || !("content" in mensaje) ||
        typeof mensaje.content !== "string" || !mensaje.content.trim())) {
        respuesta.writeHead(400);
        respuesta.end(JSON.stringify({ error: "El historial no es válido" }));
        return;
      }
      // Solo se aceptan mensajes de usuario y asistente enviados por la interfaz.
      const mensajes: MensajeChat[] = historial.map(({ role, content }) => ({ role, content }));
      respuesta.end(JSON.stringify(await responderChat(base, datos.pregunta, mensajes)));
      return;
    }
    if (typeof datos !== "object" || datos === null || !("texto" in datos) || typeof datos.texto !== "string" || !datos.texto.trim()) {
      respuesta.writeHead(400);
      respuesta.end(JSON.stringify({ error: "Ingresá un texto de reclamo" }));
      return;
    }

    const clasificacion = await clasificar(datos.texto);
    guardarTicket(base, datos.texto, clasificacion);
    respuesta.end(JSON.stringify(clasificacion));
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    respuesta.writeHead(500);
    respuesta.end(JSON.stringify({ error: esChat ? "No se pudo procesar la pregunta" : "No se pudo procesar el reclamo" }));
  }
});

// El servidor comienza a recibir solicitudes cuando el índice está listo.
try {
  console.log("Preparando documentos...");
  await indexarDocumentos(base, "documentos");
  servidor.listen(3000, () => {
    console.log("Servidor disponible en http://localhost:3000");
  });
} catch (error) {
  base.close();
  console.error("No se pudieron preparar los documentos:", error);
  process.exitCode = 1;
}
