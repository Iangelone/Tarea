import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadEnvFile } from "node:process";
import { clasificar } from "./clasificador.js";
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

// Recibe solicitudes HTTP y conecta la clasificación con el almacenamiento.
const servidor = createServer(async (solicitud, respuesta) => {
  respuesta.setHeader("Content-Type", "application/json; charset=utf-8");

  if (solicitud.method === "GET" && solicitud.url === "/") {
    respuesta.end(JSON.stringify({ mensaje: "Servidor funcionando" }));
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

  if (solicitud.method !== "POST" || solicitud.url !== "/clasificar") {
    respuesta.writeHead(404);
    respuesta.end(JSON.stringify({ error: "Ruta no encontrada" }));
    return;
  }

  try {
    // Limita el tamaño recibido antes de procesar el reclamo.
    let cuerpo = "";
    for await (const fragmento of solicitud) {
      cuerpo += fragmento;
      if (Buffer.byteLength(cuerpo) > 10_000) {
        respuesta.writeHead(413);
        respuesta.end(JSON.stringify({ error: "El reclamo es demasiado largo" }));
        return;
      }
    }

    const datos: unknown = JSON.parse(cuerpo);
    if (typeof datos !== "object" || datos === null || !("texto" in datos) || typeof datos.texto !== "string" || !datos.texto.trim()) {
      respuesta.writeHead(400);
      respuesta.end(JSON.stringify({ error: "Ingresá un texto de reclamo" }));
      return;
    }

    const clasificacion = await clasificar(datos.texto);
    guardarTicket(base, datos.texto, clasificacion);
    respuesta.end(JSON.stringify(clasificacion));
  } catch (error) {
    if (error instanceof SyntaxError) {
      respuesta.writeHead(400);
      respuesta.end(JSON.stringify({ error: "El cuerpo debe ser JSON válido" }));
      return;
    }
    console.error("Error al procesar el reclamo:", error);
    respuesta.writeHead(500);
    respuesta.end(JSON.stringify({ error: "No se pudo procesar el reclamo" }));
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
