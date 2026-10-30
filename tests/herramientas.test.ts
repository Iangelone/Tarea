import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abrirBaseDeDatos,
  guardarTicket,
  obtenerTicket,
} from "../src/base-de-datos.js";
import { crearHerramientas } from "../src/herramientas.js";

// Cada prueba utiliza una base aislada y el clasificador local.
afterEach(() => vi.unstubAllEnvs());

describe("herramientas de tickets", () => {
  it("devuelve la cantidad solicitada de tickets recientes", async () => {
    const base = abrirBaseDeDatos(":memory:");
    try {
      for (let numero = 1; numero <= 7; numero++) {
        guardarTicket(base, `Reclamo ${numero}`, {
          categoria: "otros",
          prioridad: "media",
        });
      }
      const consultar = crearHerramientas(base, new Set()).find(
        (herramienta) => herramienta.name === "consultar_tickets",
      )!;
      expect(JSON.parse(await consultar.invoke({}))).toHaveLength(5);
      const tickets = JSON.parse(await consultar.invoke({ limite: 2 }));
      expect(tickets.map((ticket: { texto: string }) => ticket.texto)).toEqual([
        "Reclamo 7",
        "Reclamo 6",
      ]);
      await expect(consultar.invoke({ limite: 21 })).rejects.toThrow();
    } finally {
      base.close();
    }
  });
  it("crea, consulta, edita y borra un ticket", async () => {
    vi.stubEnv("AI_MODE", "mock");
    const base = abrirBaseDeDatos(":memory:");
    try {
      const herramientas = crearHerramientas(base, new Set());
      const buscar = (nombre: string) => {
        const encontrada = herramientas.find(
          (herramienta) => herramienta.name === nombre,
        );
        if (!encontrada) throw new Error(`Falta la herramienta ${nombre}`);
        return encontrada;
      };
      const creado = JSON.parse(
        await buscar("crear_ticket").invoke({
          texto: "No puedo ingresar a mi cuenta",
        }),
      );
      expect(creado).toMatchObject({
        id: 1,
        categoria: "acceso",
        prioridad: "media",
      });
      const lista = JSON.parse(await buscar("consultar_tickets").invoke({}));
      expect(lista).toHaveLength(1);
      const consulta = JSON.parse(
        await buscar("consultar_tickets").invoke({ id: creado.id }),
      );
      expect(consulta.texto).toBe("No puedo ingresar a mi cuenta");
      const editado = JSON.parse(
        await buscar("editar_ticket").invoke({
          id: creado.id,
          prioridad: "alta",
        }),
      );
      expect(editado).toMatchObject({
        texto: creado.texto,
        categoria: "acceso",
        prioridad: "alta",
      });
      expect(
        JSON.parse(await buscar("borrar_ticket").invoke({ id: creado.id })),
      ).toEqual({ eliminado: true, id: creado.id });
      expect(obtenerTicket(base, creado.id)).toBeUndefined();
      expect(
        JSON.parse(await buscar("consultar_tickets").invoke({ id: creado.id })),
      ).toEqual({ error: "Ticket no encontrado" });
    } finally {
      base.close();
    }
  });

  it("rechaza valores inválidos y no modifica tickets inexistentes", async () => {
    const base = abrirBaseDeDatos(":memory:");
    try {
      const herramientas = crearHerramientas(base, new Set());
      const editar = herramientas.find(
        (herramienta) => herramienta.name === "editar_ticket",
      )!;
      await expect(
        editar.invoke({ id: 1, prioridad: "inventada" }),
      ).rejects.toThrow();
      expect(
        JSON.parse(await editar.invoke({ id: 1, prioridad: "alta" })),
      ).toEqual({ error: "Ticket no encontrado" });
      expect(JSON.parse(await editar.invoke({ id: 1 }))).toEqual({
        error: "Indica al menos un campo para modificar",
      });
    } finally {
      base.close();
    }
  });
});
