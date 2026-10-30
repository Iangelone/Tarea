import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadEnvFile } from "node:process";
import { clasificarMock } from "./clasificador-mock.js";
import { abrirBaseDeDatos, guardarTicket, listarTickets } from "./base-de-datos.js";
import { categorias, prioridades, type Clasificacion } from "./clasificacion.js";

// El archivo local es opcional: Docker también puede aportar estas variables.
try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const rutaBase = process.env.DATABASE_PATH || "data/tickets.db";
mkdirSync(dirname(rutaBase), { recursive: true });
const base = abrirBaseDeDatos(rutaBase);

async function clasificar(texto: string): Promise<Clasificacion> {
  const modo = process.env.AI_MODE || "mock";
  if (modo === "mock") return clasificarMock(texto);
  if (modo !== "gateway") throw new Error("AI_MODE debe ser mock o gateway");

  const clave = process.env.AI_GATEWAY_API_KEY;
  const modelo = process.env.DECISION_MODEL;
  if (!clave || !modelo) throw new Error("Faltan AI_GATEWAY_API_KEY o DECISION_MODEL");

  const resultado = await fetch("https://ai-gateway.vercel.sh/v1/decisions", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      input: texto,
      questions: [
        {
          type: "choice", name: "categoria", instructions: "Elegí la categoría principal del reclamo.",
          choices: [
            { value: "acceso", description: "Inicio de sesión, contraseñas y cuentas" },
            { value: "facturacion", description: "Cobros, pagos y facturas" },
            { value: "soporte_tecnico", description: "Errores y fallas del producto" },
            { value: "seguridad", description: "Accesos sospechosos o filtración de información" },
            { value: "otros", description: "Reclamos que no encajan en las demás categorías" },
          ],
        },
        {
          type: "choice", name: "prioridad", instructions: "Elegí la prioridad según impacto y urgencia, sin asumir datos que no aparecen.",
          choices: [
            { value: "baja", description: "Consulta o inconveniente menor sin urgencia" },
            { value: "media", description: "Problema limitado que no detiene una operación importante" },
            { value: "alta", description: "Impacto importante o necesidad urgente de atención" },
            { value: "critica", description: "Servicio general caído o incidente grave de seguridad confirmado" },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resultado.ok) throw new Error(`El servicio de clasificación respondió HTTP ${resultado.status}`);

  const datos: unknown = await resultado.json();
  if (typeof datos !== "object" || datos === null || !("answers" in datos) || !Array.isArray(datos.answers)) {
    throw new Error("El servicio de clasificación devolvió una respuesta inválida");
  }
  const respuestas = datos.answers as unknown[];
  const obtenerOpcion = (nombre: string): unknown => {
    const respuesta = respuestas.find((item) => typeof item === "object" && item !== null && "name" in item && item.name === nombre);
    return typeof respuesta === "object" && respuesta !== null && "type" in respuesta && respuesta.type === "choice" && "choice" in respuesta ? respuesta.choice : undefined;
  };
  const categoria = obtenerOpcion("categoria");
  const prioridad = obtenerOpcion("prioridad");
  if (typeof categoria !== "string" || !categorias.some((valor) => valor === categoria) ||
      typeof prioridad !== "string" || !prioridades.some((valor) => valor === prioridad)) {
    throw new Error("El servicio de clasificación devolvió opciones inválidas");
  }
  return { categoria: categoria as Clasificacion["categoria"], prioridad: prioridad as Clasificacion["prioridad"] };
}

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

servidor.listen(3000, () => {
  console.log("Servidor disponible en http://localhost:3000");
});
