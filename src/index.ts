import { createServer } from "node:http";
import { clasificarMock } from "./clasificador-mock.js";

const servidor = createServer(async (solicitud, respuesta) => {
  respuesta.setHeader("Content-Type", "application/json; charset=utf-8");

  if (solicitud.method === "GET" && solicitud.url === "/") {
    respuesta.end(JSON.stringify({ mensaje: "Servidor funcionando" }));
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

    respuesta.end(JSON.stringify(clasificarMock(datos.texto)));
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
