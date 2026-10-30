import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirBaseDeDatos } from "../src/base-de-datos.js";
import { responderChat } from "../src/chat.js";
import { buscarFragmentos } from "../src/busqueda.js";

vi.mock("../src/busqueda.js", () => ({ buscarFragmentos: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("chat en modo mock", () => {
  it("responde un saludo sin buscar documentos", async () => {
    vi.stubEnv("AI_MODE", "mock");
    const base = abrirBaseDeDatos(":memory:");
    try {
      expect(await responderChat(base, "Hola")).toEqual({
        respuesta: "Hola, ¿en qué puedo ayudarte?",
        fuentes: [],
      });
      expect(buscarFragmentos).not.toHaveBeenCalled();
    } finally {
      base.close();
    }
  });

  it("devuelve el fragmento encontrado y su fuente", async () => {
    vi.stubEnv("AI_MODE", "mock");
    vi.mocked(buscarFragmentos).mockResolvedValue([
      {
        fuente: "acceso.md",
        contenido: "Recupera tu contraseña",
        similitud: 0.9,
      },
    ]);
    const base = abrirBaseDeDatos(":memory:");
    try {
      expect(await responderChat(base, "¿Cómo ingreso?")).toEqual({
        respuesta: "Fragmento encontrado:\nRecupera tu contraseña",
        fuentes: ["acceso.md"],
      });
    } finally {
      base.close();
    }
  });

  it("rechaza preguntas vacías", async () => {
    const base = abrirBaseDeDatos(":memory:");
    try {
      await expect(responderChat(base, "  ")).rejects.toThrow(
        "La pregunta no puede estar vacía",
      );
    } finally {
      base.close();
    }
  });
});
