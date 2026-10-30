import { tool } from "langchain";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { buscarFragmentos } from "./busqueda.js";
import { clasificar } from "./clasificador.js";
import { categorias, prioridades } from "./clasificacion.js";
import {
  actualizarTicket,
  eliminarTicket,
  guardarTicket,
  listarTickets,
  obtenerTicket,
} from "./base-de-datos.js";

// Las herramientas reciben datos validados y ejecutan operaciones concretas sobre SQLite.
export function crearHerramientas(base: DatabaseSync, fuentes: Set<string>) {
  const id = z.number().int().positive().describe("Identificador del ticket");
  return [
    tool(
      async ({ consulta }) => {
        const fragmentos = await buscarFragmentos(base, consulta);
        for (const fragmento of fragmentos) fuentes.add(fragmento.fuente);
        return JSON.stringify(
          fragmentos.map(({ fuente, contenido }) => ({ fuente, contenido })),
        );
      },
      {
        name: "buscar_documentos",
        description:
          "Busca información en los documentos de soporte de la empresa.",
        schema: z.object({ consulta: z.string().trim().min(1) }),
      },
    ),
    tool(
      async ({ texto }) => {
        const clasificacion = await clasificar(texto);
        const id = guardarTicket(base, texto, clasificacion);
        return JSON.stringify(obtenerTicket(base, id));
      },
      {
        name: "crear_ticket",
        description:
          "Crea y clasifica un ticket cuando el usuario lo solicita expresamente.",
        schema: z.object({
          texto: z
            .string()
            .trim()
            .min(1)
            .max(10000)
            .describe("Descripción del reclamo"),
        }),
      },
    ),
    tool(
      ({ id }) =>
        JSON.stringify(
          id === undefined
            ? listarTickets(base).slice(0, 20)
            : (obtenerTicket(base, id) ?? { error: "Ticket no encontrado" }),
        ),
      {
        name: "consultar_tickets",
        description:
          "Consulta un ticket por ID o los 20 más recientes si no se indica uno.",
        schema: z.object({ id: id.optional() }),
      },
    ),
    tool(
      ({ id, texto, categoria, prioridad }) => {
        if (
          texto === undefined &&
          categoria === undefined &&
          prioridad === undefined
        )
          return JSON.stringify({
            error: "Indica al menos un campo para modificar",
          });
        return JSON.stringify(
          actualizarTicket(base, id, { texto, categoria, prioridad }) ?? {
            error: "Ticket no encontrado",
          },
        );
      },
      {
        name: "editar_ticket",
        description:
          "Modifica únicamente los campos solicitados de un ticket identificado por ID.",
        schema: z.object({
          id,
          texto: z.string().trim().min(1).max(10000).optional(),
          categoria: z.enum(categorias).optional(),
          prioridad: z.enum(prioridades).optional(),
        }),
      },
    ),
    tool(
      ({ id }) =>
        JSON.stringify(
          eliminarTicket(base, id)
            ? { eliminado: true, id }
            : { error: "Ticket no encontrado" },
        ),
      {
        name: "borrar_ticket",
        description:
          "Elimina un ticket identificado por ID cuando el usuario pide eliminarlo expresamente.",
        schema: z.object({ id }),
      },
    ),
  ];
}
