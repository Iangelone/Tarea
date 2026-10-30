import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  abrirBaseDeDatos,
  guardarTicket,
  listarTickets,
  guardarDocumentoIndexado,
  listarFragmentos,
} from "../src/base-de-datos.js";

const directorios: string[] = [];
afterEach(() => {
  for (const ruta of directorios.splice(0))
    rmSync(ruta, { recursive: true, force: true });
});

describe("almacenamiento SQLite", () => {
  it("conserva tickets al cerrar y volver a abrir, ordenados por el más reciente", () => {
    const directorio = mkdtempSync(join(tmpdir(), "tickets-test-"));
    directorios.push(directorio);
    const ruta = join(directorio, "datos.db");
    let base = abrirBaseDeDatos(ruta);
    try {
      guardarTicket(base, "No puedo entrar", {
        categoria: "acceso",
        prioridad: "media",
      });
      guardarTicket(base, "Factura incorrecta", {
        categoria: "facturacion",
        prioridad: "alta",
      });
    } finally {
      base.close();
    }
    base = abrirBaseDeDatos(ruta);
    try {
      const tickets = listarTickets(base);
      expect(tickets.map((ticket) => ticket.texto)).toEqual([
        "Factura incorrecta",
        "No puedo entrar",
      ]);
      expect(tickets[0]).toMatchObject({
        categoria: "facturacion",
        prioridad: "alta",
      });
    } finally {
      base.close();
    }
  });

  it("conserva los fragmentos anteriores cuando una actualización no es válida", () => {
    const base = abrirBaseDeDatos(":memory:");
    try {
      const documento = {
        fuente: "acceso.md",
        huella: "original",
        version: "1",
      };
      const fragmento = {
        fuente: documento.fuente,
        contenido: "Contenido original",
        embedding: Array(384).fill(0.1),
      };
      guardarDocumentoIndexado(base, documento, [fragmento]);
      expect(() =>
        guardarDocumentoIndexado(base, { ...documento, huella: "nueva" }, [
          { ...fragmento, embedding: [1] },
        ]),
      ).toThrow();
      expect(listarFragmentos(base)).toEqual([fragmento]);
    } finally {
      base.close();
    }
  });
});
