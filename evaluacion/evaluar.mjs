import { loadEnvFile } from "node:process";
import { abrirBaseDeDatos } from "../dist/base-de-datos.js";
import { clasificar } from "../dist/clasificador.js";
import { indexarDocumentos } from "../dist/indexador.js";
import { buscarFragmentos } from "../dist/busqueda.js";
import { responderChat } from "../dist/chat.js";

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!process.env.OPENROUTER_API_KEY) {
  console.error(
    "Configura OPENROUTER_API_KEY para ejecutar la evaluación real.",
  );
  process.exit(1);
}
process.env.AI_MODE = "gateway";

// Casos ficticios con resultados esperados definidos antes de consultar el modelo.
const reclamos = [
  {
    texto: "Olvidé mi contraseña y no puedo entrar a mi cuenta.",
    categoria: "acceso",
    prioridad: "media",
  },
  {
    texto: "Consulta sin urgencia: ¿dónde encuentro mi factura?",
    categoria: "facturacion",
    prioridad: "baja",
  },
  {
    texto: "Me cobraron dos veces este mes; necesito revisar el pago.",
    categoria: "facturacion",
    prioridad: "media",
  },
  {
    texto:
      "El botón de guardar falla para un usuario, pero puede seguir trabajando.",
    categoria: "soporte_tecnico",
    prioridad: "media",
  },
  {
    texto: "Todos los usuarios están bloqueados: el servicio está caído.",
    categoria: "soporte_tecnico",
    prioridad: "critica",
  },
  {
    texto: "Confirmamos una filtración de credenciales de clientes.",
    categoria: "seguridad",
    prioridad: "critica",
  },
  {
    texto: "Urgente: detecté una sesión desconocida en mi cuenta.",
    categoria: "seguridad",
    prioridad: "alta",
  },
  {
    texto: "Quisiera proponer una mejora visual para el menú.",
    categoria: "otros",
    prioridad: "baja",
  },
];
const preguntas = [
  {
    pregunta: "¿Cuánto dura el enlace para cambiar la contraseña?",
    fuente: "acceso.md",
    esperado: "30 minutos",
  },
  {
    pregunta:
      "¿Cuánto tarda el reintegro después de confirmar un cobro duplicado?",
    fuente: "facturacion.md",
    esperado: "Cinco días hábiles; el banco puede tardar más",
  },
  {
    pregunta: "¿Qué hago si un mensaje me pide mi contraseña?",
    fuente: "seguridad.md",
    esperado:
      "No compartir credenciales; ignorar el mensaje y avisar a soporte",
  },
  {
    pregunta: "¿Qué datos pide soporte para investigar un error?",
    fuente: "soporte-tecnico.md",
    esperado: "Descripción, hora aproximada, pasos y mensaje de error",
  },
];
const fueraDeDocumentos = [
  {
    pregunta: "¿Cuál es el precio del plan premium?",
    esperado: "Los documentos no indican un precio",
  },
];

const base = abrirBaseDeDatos(":memory:");
let errores = 0;
try {
  console.log("\nCLASIFICACIÓN: esperado → obtenido");
  let categoriasCorrectas = 0;
  let prioridadesCorrectas = 0;
  for (const caso of reclamos) {
    try {
      const resultado = await clasificar(caso.texto);
      categoriasCorrectas += Number(resultado.categoria === caso.categoria);
      prioridadesCorrectas += Number(resultado.prioridad === caso.prioridad);
      console.log(
        JSON.stringify({
          texto: caso.texto,
          esperado: { categoria: caso.categoria, prioridad: caso.prioridad },
          obtenido: resultado,
        }),
      );
    } catch (error) {
      errores++;
      console.error(
        JSON.stringify({ texto: caso.texto, error: error.message }),
      );
    }
  }
  console.log(
    `Categorías: ${categoriasCorrectas}/${reclamos.length}. Prioridades: ${prioridadesCorrectas}/${reclamos.length}.`,
  );

  console.log("\nPreparando índice temporal de documentos...");
  await indexarDocumentos(base, "documentos");
  let primeroCorrecto = 0;
  let tresCorrectos = 0;
  console.log(
    "\nRAG: fuente esperada, fuentes recuperadas y respuesta para revisión manual",
  );
  for (const caso of preguntas) {
    try {
      const recuperados = await buscarFragmentos(base, caso.pregunta);
      primeroCorrecto += Number(recuperados[0]?.fuente === caso.fuente);
      tresCorrectos += Number(
        recuperados.some((fragmento) => fragmento.fuente === caso.fuente),
      );
      const respuesta = await responderChat(base, caso.pregunta);
      console.log(
        JSON.stringify({
          ...caso,
          fuentesRecuperadas: recuperados.map((fragmento) => fragmento.fuente),
          respuesta: respuesta.respuesta,
          fuentesConsultadas: respuesta.fuentes,
        }),
      );
    } catch (error) {
      errores++;
      console.error(
        JSON.stringify({ pregunta: caso.pregunta, error: error.message }),
      );
    }
  }
  console.log(
    `Fuente esperada: primera ${primeroCorrecto}/${preguntas.length}; entre las tres ${tresCorrectos}/${preguntas.length}.`,
  );
  console.log("\nPREGUNTA FUERA DE DOCUMENTOS: revisión manual");
  for (const caso of fueraDeDocumentos) {
    try {
      const respuesta = await responderChat(base, caso.pregunta);
      console.log(
        JSON.stringify({
          ...caso,
          respuesta: respuesta.respuesta,
          fuentesConsultadas: respuesta.fuentes,
        }),
      );
    } catch (error) {
      errores++;
      console.error(
        JSON.stringify({ pregunta: caso.pregunta, error: error.message }),
      );
    }
  }
  console.log(
    "\nLas respuestas del chat requieren revisión manual; las fuentes no garantizan que la respuesta sea correcta.",
  );
  if (errores) {
    console.error(
      `No se pudieron evaluar ${errores} casos por errores de ejecución.`,
    );
    process.exitCode = 1;
  }
} finally {
  base.close();
}
