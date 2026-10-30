import { createServer } from "node:http";

const servidor = createServer((_solicitud, respuesta) => {
  respuesta.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  respuesta.end(JSON.stringify({ mensaje: "Servidor funcionando" }));
});

servidor.listen(3000, () => {
  console.log("Servidor disponible en http://localhost:3000");
});
