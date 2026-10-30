import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export type Fragmento = {
  contenido: string;
  fuente: string;
};

// Conserva el archivo de origen para poder citarlo en las respuestas.
export async function leerDocumentos(directorio: string): Promise<Fragmento[]> {
  const archivos = (await readdir(directorio, { withFileTypes: true }))
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith(".md"))
    .map((entrada) => entrada.name)
    .sort();

  const divisor = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  const documentos = await Promise.all(
    archivos.map(async (archivo) => {
      const contenido = await readFile(join(directorio, archivo), "utf8");
      const partes = await divisor.splitText(contenido);
      return partes.map((parte) => ({ contenido: parte, fuente: archivo }));
    }),
  );

  return documentos.flat();
}
