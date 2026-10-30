import { clasificarMock } from "./clasificador-mock.js";
import {
  categorias,
  prioridades,
  type Clasificacion,
} from "./clasificacion.js";

// Jev responde ambas preguntas en una sola solicitud a OpenRouter.
export async function clasificar(texto: string): Promise<Clasificacion> {
  const modo = process.env.AI_MODE || "mock";
  if (modo === "mock") return clasificarMock(texto);
  if (modo !== "gateway") throw new Error("AI_MODE debe ser mock o gateway");

  const clave = process.env.OPENROUTER_API_KEY;
  if (!clave) throw new Error("Falta OPENROUTER_API_KEY");
  const resultado = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DECISION_MODEL || "typesafe/jev-1.13",
      state: { reclamo: texto },
      questions: {
        categoria: {
          type: "choice",
          instructions: "Elige la categoría principal del reclamo.",
          criteria: {
            acceso: "Inicio de sesión, contraseñas y cuentas",
            facturacion: "Cobros, pagos y facturas",
            soporte_tecnico: "Errores y fallas del producto",
            seguridad: "Accesos sospechosos o filtración de información",
            otros: "Reclamos que no encajan en las demás categorías",
          },
        },
        prioridad: {
          type: "choice",
          instructions:
            "Elige la prioridad según impacto y urgencia, sin asumir datos que no aparecen.",
          criteria: {
            baja: "Consulta o inconveniente menor sin urgencia",
            media: "Problema limitado que no detiene una operación importante",
            alta: "Impacto importante o necesidad urgente de atención",
            critica:
              "Servicio general caído o incidente grave de seguridad confirmado",
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resultado.ok)
    throw new Error(
      `El servicio de clasificación respondió HTTP ${resultado.status}`,
    );

  // Valida los valores externos antes de guardar la clasificación.
  const datos: unknown = await resultado.json();
  if (
    typeof datos !== "object" ||
    datos === null ||
    !("answers" in datos) ||
    typeof datos.answers !== "object" ||
    datos.answers === null ||
    Array.isArray(datos.answers)
  ) {
    throw new Error(
      "El servicio de clasificación devolvió una respuesta inválida",
    );
  }
  const respuestas = datos.answers as Record<string, unknown>;
  const opcion = (nombre: string): unknown => {
    const respuesta = respuestas[nombre];
    return typeof respuesta === "object" &&
      respuesta !== null &&
      "type" in respuesta &&
      respuesta.type === "choice" &&
      "choice" in respuesta
      ? respuesta.choice
      : undefined;
  };
  const categoria = opcion("categoria");
  const prioridad = opcion("prioridad");
  if (
    typeof categoria !== "string" ||
    !categorias.some((valor) => valor === categoria) ||
    typeof prioridad !== "string" ||
    !prioridades.some((valor) => valor === prioridad)
  ) {
    throw new Error("El servicio de clasificación devolvió opciones inválidas");
  }
  return {
    categoria: categoria as Clasificacion["categoria"],
    prioridad: prioridad as Clasificacion["prioridad"],
  };
}
