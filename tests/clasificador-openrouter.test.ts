import { afterEach, describe, expect, it, vi } from "vitest";
import { clasificar } from "../src/clasificador.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("clasificador OpenRouter", () => {
  it("envía las dos preguntas a Jev y valida su respuesta", async () => {
    vi.stubEnv("AI_MODE", "gateway");
    vi.stubEnv("OPENROUTER_API_KEY", "clave-de-prueba");
    vi.stubEnv("DECISION_MODEL", "typesafe/jev-1.13");
    const fetchSimulado = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: {
            categoria: { type: "choice", choice: "acceso" },
            prioridad: { type: "choice", choice: "media" },
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchSimulado);
    expect(await clasificar("No puedo ingresar")).toEqual({
      categoria: "acceso",
      prioridad: "media",
    });
    const [url, opciones] = fetchSimulado.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.model).toBe("typesafe/jev-1.13");
    expect(cuerpo.state.reclamo).toBe("No puedo ingresar");
    expect(Object.keys(cuerpo.questions)).toEqual(["categoria", "prioridad"]);
    expect(cuerpo.questions.categoria.criteria.acceso).toBeTruthy();
  });

  it("rechaza opciones desconocidas en la respuesta", async () => {
    vi.stubEnv("AI_MODE", "gateway");
    vi.stubEnv("OPENROUTER_API_KEY", "clave-de-prueba");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            answers: {
              categoria: { type: "choice", choice: "desconocida" },
              prioridad: { type: "choice", choice: "alta" },
            },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(clasificar("Consulta")).rejects.toThrow("opciones inválidas");
  });

  it("informa la falta de clave", async () => {
    vi.stubEnv("AI_MODE", "gateway");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(clasificar("Consulta")).rejects.toThrow(
      "Falta OPENROUTER_API_KEY",
    );
  });
});
