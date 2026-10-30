import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirBaseDeDatos } from "../src/base-de-datos.js";

const llamadas = vi.hoisted(() => ({ modelo: vi.fn(), invoke: vi.fn() }));
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class {
    constructor(opciones: unknown) {
      llamadas.modelo(opciones);
    }
  },
}));
vi.mock("langchain", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("langchain")>();
  return { ...original, createAgent: () => ({ invoke: llamadas.invoke }) };
});
import { responderChat } from "../src/chat.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("chat con OpenRouter", () => {
  it("configura DeepSeek y conserva el historial", async () => {
    vi.stubEnv("AI_MODE", "gateway");
    vi.stubEnv("OPENROUTER_API_KEY", "clave-de-prueba");
    vi.stubEnv("CHAT_MODEL", "");
    llamadas.invoke.mockResolvedValue({
      messages: [{ content: "Hola de nuevo" }],
    });
    const base = abrirBaseDeDatos(":memory:");
    try {
      const historial = [{ role: "user" as const, content: "Hola" }];
      expect(await responderChat(base, "¿Cómo estás?", historial)).toEqual({
        respuesta: "Hola de nuevo",
        fuentes: [],
      });
      expect(llamadas.modelo).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "clave-de-prueba",
          model: "deepseek/deepseek-v4.1-flash-1017",
          configuration: { baseURL: "https://openrouter.ai/api/v1" },
        }),
      );
      expect(llamadas.invoke.mock.calls[0][0].messages).toEqual([
        ...historial,
        { role: "user", content: "¿Cómo estás?" },
      ]);
    } finally {
      base.close();
    }
  });
});
