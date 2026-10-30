import { DatabaseSync } from "node:sqlite";
import type { Clasificacion } from "./clasificacion.js";

export type Ticket = Clasificacion & {
  id: number;
  texto: string;
  creadoEn: string;
};

// Abre SQLite y prepara la tabla donde se guardan los tickets.
export function abrirBaseDeDatos(ruta: string): DatabaseSync {
  const base = new DatabaseSync(ruta);

  base.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      texto TEXT NOT NULL,
      categoria TEXT NOT NULL,
      prioridad TEXT NOT NULL,
      creado_en TEXT NOT NULL
    )
  `);

  return base;
}

export function guardarTicket(
  base: DatabaseSync,
  texto: string,
  clasificacion: Clasificacion,
): number {
  // Los parámetros evitan interpretar el texto del reclamo como SQL.
  const resultado = base.prepare(`
    INSERT INTO tickets (texto, categoria, prioridad, creado_en)
    VALUES (?, ?, ?, ?)
  `).run(texto, clasificacion.categoria, clasificacion.prioridad, new Date().toISOString());

  return Number(resultado.lastInsertRowid);
}

// Devuelve primero los tickets más recientes.
export function listarTickets(base: DatabaseSync): Ticket[] {
  const filas = base.prepare(`
    SELECT id, texto, categoria, prioridad, creado_en AS creadoEn
    FROM tickets
    ORDER BY id DESC
  `).all();

  return filas as Ticket[];
}
