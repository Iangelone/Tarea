import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";
import {
  eliminarDocumentoIndexado,
  guardarDocumentoIndexado,
  listarDocumentosIndexados,
} from "./base-de-datos.js";
import { leerDocumentos } from "./documentos.js";
import { generarEmbedding } from "./embeddings.js";

// Cambiar esta versión cuando cambie el modelo o la forma de dividir documentos.
const versionIndice = "multilingual-e5-small-q8-fragmentos-500-50-v1";

export async function indexarDocumentos(base: DatabaseSync, directorio: string): Promise<void> {
  const archivos = (await readdir(directorio, { withFileTypes: true }))
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith(".md"))
    .map((entrada) => entrada.name)
    .sort();
  const partes = await leerDocumentos(directorio);
  const indexados = new Map(listarDocumentosIndexados(base).map((documento) => [documento.fuente, documento]));

  for (const fuente of archivos) {
    const fragmentos = partes.filter((parte) => parte.fuente === fuente);
    // La huella representa exactamente los fragmentos que se envían al modelo.
    const huella = createHash("sha256").update(JSON.stringify(fragmentos.map((parte) => parte.contenido))).digest("hex");
    const anterior = indexados.get(fuente);
    if (anterior?.huella === huella && anterior.version === versionIndice) continue;

    const preparados = [];
    for (const fragmento of fragmentos) {
      const embedding = await generarEmbedding(fragmento.contenido, "documento");
      preparados.push({ ...fragmento, embedding });
    }
    guardarDocumentoIndexado(base, { fuente, huella, version: versionIndice }, preparados);
  }

  // Solo se eliminan entradas antiguas después de leer e indexar correctamente.
  const disponibles = new Set(archivos);
  for (const fuente of indexados.keys()) {
    if (!disponibles.has(fuente)) eliminarDocumentoIndexado(base, fuente);
  }
}
