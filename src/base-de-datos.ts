import { DatabaseSync } from "node:sqlite";
import type { Clasificacion } from "./clasificacion.js";
import type { Fragmento } from "./documentos.js";

export type Ticket = Clasificacion & {
  id: number;
  texto: string;
  creadoEn: string;
};

export type FragmentoConEmbedding = Fragmento & {
  embedding: number[];
};

// Abre SQLite y prepara las tablas de tickets y fragmentos.
export function abrirBaseDeDatos(ruta: string): DatabaseSync {
  const base = new DatabaseSync(ruta);

  base.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      texto TEXT NOT NULL,
      categoria TEXT NOT NULL,
      prioridad TEXT NOT NULL,
      creado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documentos_indexados (
      fuente TEXT PRIMARY KEY,
      huella TEXT NOT NULL,
      version TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fragmentos (
      id INTEGER PRIMARY KEY,
      fuente TEXT NOT NULL,
      contenido TEXT NOT NULL,
      embedding TEXT NOT NULL
    );
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

// Sustituye el índice completo en una transacción para evitar datos parciales.
export function guardarFragmentos(base: DatabaseSync, fragmentos: FragmentoConEmbedding[]): void {
  for (const fragmento of fragmentos) {
    if (!fragmento.fuente.trim() || !fragmento.contenido.trim() ||
        fragmento.embedding.length !== 384 || !fragmento.embedding.every(Number.isFinite)) {
      throw new Error("El fragmento o su embedding no es válido");
    }
  }

  const insertar = base.prepare(`
    INSERT INTO fragmentos (fuente, contenido, embedding) VALUES (?, ?, ?)
  `);
  base.exec("BEGIN");
  try {
    base.exec("DELETE FROM fragmentos");
    base.exec("DELETE FROM documentos_indexados");
    for (const fragmento of fragmentos) {
      insertar.run(fragmento.fuente, fragmento.contenido, JSON.stringify(fragmento.embedding));
    }
    base.exec("COMMIT");
  } catch (error) {
    base.exec("ROLLBACK");
    throw error;
  }
}

// Recupera los vectores como números para compararlos con una consulta.
export function listarFragmentos(base: DatabaseSync): FragmentoConEmbedding[] {
  const filas = base.prepare("SELECT fuente, contenido, embedding FROM fragmentos ORDER BY id").all();
  return filas.map((fila) => {
    if (typeof fila.fuente !== "string" || typeof fila.contenido !== "string" ||
        typeof fila.embedding !== "string") {
      throw new Error("El fragmento almacenado no es válido");
    }
    const embedding: unknown = JSON.parse(fila.embedding);
    if (!Array.isArray(embedding) || embedding.length !== 384 || !embedding.every((valor) => typeof valor === "number" && Number.isFinite(valor))) {
      throw new Error("El embedding almacenado no es válido");
    }
    return { fuente: fila.fuente, contenido: fila.contenido, embedding };
  });
}

export type DocumentoIndexado = {
  fuente: string;
  huella: string;
  version: string;
};

// La versión permite regenerar los vectores si cambia el modelo o la división.
export function listarDocumentosIndexados(base: DatabaseSync): DocumentoIndexado[] {
  return base.prepare("SELECT fuente, huella, version FROM documentos_indexados ORDER BY fuente").all() as DocumentoIndexado[];
}

// Actualiza un documento completo sin alterar el índice anterior si ocurre un error.
export function guardarDocumentoIndexado(
  base: DatabaseSync,
  documento: DocumentoIndexado,
  fragmentos: FragmentoConEmbedding[],
): void {
  if (!documento.fuente.trim() || !documento.huella.trim() || !documento.version.trim() ||
      fragmentos.some((fragmento) => fragmento.fuente !== documento.fuente ||
        !fragmento.contenido.trim() || fragmento.embedding.length !== 384 ||
        !fragmento.embedding.every(Number.isFinite))) {
    throw new Error("El documento o sus fragmentos no son válidos");
  }

  const eliminar = base.prepare("DELETE FROM fragmentos WHERE fuente = ?");
  const insertar = base.prepare("INSERT INTO fragmentos (fuente, contenido, embedding) VALUES (?, ?, ?)");
  const guardar = base.prepare(`
    INSERT INTO documentos_indexados (fuente, huella, version) VALUES (?, ?, ?)
    ON CONFLICT(fuente) DO UPDATE SET huella = excluded.huella, version = excluded.version
  `);

  base.exec("BEGIN");
  try {
    eliminar.run(documento.fuente);
    for (const fragmento of fragmentos) {
      insertar.run(fragmento.fuente, fragmento.contenido, JSON.stringify(fragmento.embedding));
    }
    guardar.run(documento.fuente, documento.huella, documento.version);
    base.exec("COMMIT");
  } catch (error) {
    base.exec("ROLLBACK");
    throw error;
  }
}

// Elimina el índice de un archivo que ya no está disponible.
export function eliminarDocumentoIndexado(base: DatabaseSync, fuente: string): void {
  base.exec("BEGIN");
  try {
    base.prepare("DELETE FROM fragmentos WHERE fuente = ?").run(fuente);
    base.prepare("DELETE FROM documentos_indexados WHERE fuente = ?").run(fuente);
    base.exec("COMMIT");
  } catch (error) {
    base.exec("ROLLBACK");
    throw error;
  }
}
