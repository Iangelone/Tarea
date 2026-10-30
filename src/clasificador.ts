import { clasificarMock } from "./clasificador-mock.js";
import {
  categorias,
  prioridades,
  type Clasificacion,
} from "./clasificacion.js";

// Clasifica el reclamo con reglas locales o con el modelo configurado.
export async function clasificar(texto: string): Promise<Clasificacion> {
  const modo = process.env.AI_MODE || "mock";
  if (modo === "mock") return clasificarMock(texto);
  if (modo !== "gateway") throw new Error("AI_MODE debe ser mock o gateway");

  const clave = process.env.AI_GATEWAY_API_KEY;
  const modelo = process.env.DECISION_MODEL;
  if (!clave || !modelo)
    throw new Error("Faltan AI_GATEWAY_API_KEY o DECISION_MODEL");

  const resultado = await fetch("https://ai-gateway.vercel.sh/v1/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      input: texto,
      questions: [
        {
          type: "choice",
          name: "categoria",
          instructions: "Elegí la categoría principal del reclamo.",
          choices: [
            {
              value: "acceso",
              description: "Inicio de sesión, contraseñas y cuentas",
            },
            { value: "facturacion", description: "Cobros, pagos y facturas" },
            {
              value: "soporte_tecnico",
              description: "Errores y fallas del producto",
            },
            {
              value: "seguridad",
              description: "Accesos sospechosos o filtración de información",
            },
            {
              value: "otros",
              description: "Reclamos que no encajan en las demás categorías",
            },
          ],
        },
        {
          type: "choice",
          name: "prioridad",
          instructions:
            "Elegí la prioridad según impacto y urgencia, sin asumir datos que no aparecen.",
          choices: [
            {
              value: "baja",
              description: "Consulta o inconveniente menor sin urgencia",
            },
            {
              value: "media",
              description:
                "Problema limitado que no detiene una operación importante",
            },
            {
              value: "alta",
              description: "Impacto importante o necesidad urgente de atención",
            },
            {
              value: "critica",
              description:
                "Servicio general caído o incidente grave de seguridad confirmado",
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resultado.ok)
    throw new Error(
      `El servicio de clasificación respondió HTTP ${resultado.status}`,
    );

  // Valida la respuesta externa antes de usar sus valores.
  const datos: unknown = await resultado.json();
  if (
    typeof datos !== "object" ||
    datos === null ||
    !("answers" in datos) ||
    !Array.isArray(datos.answers)
  ) {
    throw new Error(
      "El servicio de clasificación devolvió una respuesta inválida",
    );
  }
  const respuestas = datos.answers as unknown[];
  const obtenerOpcion = (nombre: string): unknown => {
    const respuesta = respuestas.find(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "name" in item &&
        item.name === nombre,
    );
    return typeof respuesta === "object" &&
      respuesta !== null &&
      "type" in respuesta &&
      respuesta.type === "choice" &&
      "choice" in respuesta
      ? respuesta.choice
      : undefined;
  };
  const categoria = obtenerOpcion("categoria");
  const prioridad = obtenerOpcion("prioridad");
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
