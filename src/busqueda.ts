import type { DatabaseSync } from "node:sqlite";
import { listarFragmentos } from "./base-de-datos.js";
import { generarEmbedding } from "./embeddings.js";

export type ResultadoBusqueda = {
  fuente: string;
  contenido: string;
  similitud: number;
};

// Compara la dirección de dos vectores, independientemente de su longitud.
function similitudCoseno(a: number[], b: number[]): number {
  if (a.length !== b.length)
    throw new Error("Los embeddings tienen dimensiones distintas");
  let producto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    producto += a[i] * b[i];
    normaA += a[i] ** 2;
    normaB += b[i] ** 2;
  }
  if (normaA === 0 || normaB === 0)
    throw new Error("No se puede comparar un embedding vacío");
  return producto / Math.sqrt(normaA * normaB);
}

// Ordena los fragmentos por cercanía semántica y conserva su fuente.
export async function buscarFragmentos(
  base: DatabaseSync,
  consulta: string,
  limite = 3,
): Promise<ResultadoBusqueda[]> {
  if (!consulta.trim()) throw new Error("La consulta no puede estar vacía");
  if (!Number.isInteger(limite) || limite < 1)
    throw new Error("El límite debe ser un entero positivo");

  const fragmentos = listarFragmentos(base);
  if (fragmentos.length === 0) return [];
  const embedding = await generarEmbedding(consulta, "consulta");
  return fragmentos
    .map((fragmento) => ({
      fuente: fragmento.fuente,
      contenido: fragmento.contenido,
      similitud: similitudCoseno(embedding, fragmento.embedding),
    }))
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, limite);
}
