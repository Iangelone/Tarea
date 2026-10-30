import { createMiddleware, tool } from "langchain";
import { z } from "zod";

const nombres = [
  "buscar_documentos",
  "crear_ticket",
  "consultar_tickets",
  "editar_ticket",
  "borrar_ticket",
] as const;

// Cada consulta activa solo las herramientas solicitadas por el modelo.
export function crearDescubrimiento() {
  const disponibles = new Set<string>();
  const buscar = tool(
    ({ herramientas }) => {
      for (const nombre of herramientas) disponibles.add(nombre);
      return `Herramientas disponibles: ${herramientas.join(", ")}. Úsalas para completar la solicitud.`;
    },
    {
      name: "buscar_herramientas",
      description:
        "Habilita las herramientas necesarias: buscar_documentos para documentación; crear_ticket, consultar_tickets, editar_ticket o borrar_ticket para operaciones de tickets.",
      schema: z.object({
        herramientas: z.array(z.enum(nombres)).min(1).max(nombres.length),
      }),
    },
  );
  const middleware = createMiddleware({
    name: "DescubrirHerramientas",
    wrapModelCall: (solicitud, continuar) =>
      continuar({
        ...solicitud,
        tools: solicitud.tools.filter(
          (herramienta) =>
            herramienta.name === buscar.name ||
            (typeof herramienta.name === "string" &&
              disponibles.has(herramienta.name)),
        ),
      }),
  });
  return { buscar, middleware };
}
