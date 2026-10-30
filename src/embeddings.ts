import { pipeline } from "@huggingface/transformers";

const modelo = "Xenova/multilingual-e5-small";
let carga: ReturnType<typeof cargarModelo> | undefined;

function cargarModelo() {
  return pipeline("feature-extraction", modelo, { dtype: "q8", device: "cpu" });
}

// Comparte la carga entre solicitudes y permite reintentar si falla.
function obtenerModelo() {
  if (!carga) {
    carga = cargarModelo().catch((error: unknown) => {
      carga = undefined;
      throw error;
    });
  }
  return carga;
}

export async function generarEmbedding(
  texto: string,
  tipo: "documento" | "consulta",
): Promise<number[]> {
  if (!texto.trim())
    throw new Error("El texto para el embedding no puede estar vacío");

  const extractor = await obtenerModelo();
  // E5 usa prefijos distintos para consultas y documentos.
  const prefijo = tipo === "consulta" ? "query" : "passage";
  const resultado = await extractor(`${prefijo}: ${texto}`, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(resultado.data, Number);
}
