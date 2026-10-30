import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { abrirBaseDeDatos } from "../src/base-de-datos.js";
import { crearDescubrimiento } from "../src/descubrimiento.js";
import { crearHerramientas } from "../src/herramientas.js";

describe("descubrimiento de herramientas", () => {
  it("expone solo las herramientas solicitadas y aísla cada consulta", async () => {
    const base = abrirBaseDeDatos(":memory:");
    try {
      const primera = crearDescubrimiento();
      const segunda = crearDescubrimiento();
      const herramientas = [
        primera.buscar,
        ...crearHerramientas(base, new Set()),
      ];
      const visibles = async (descubrimiento: typeof primera) => {
        let nombres: unknown[] = [];
        await descubrimiento.middleware.wrapModelCall!(
          { tools: herramientas } as never,
          async (solicitud) => {
            nombres = solicitud.tools.map((herramienta) => herramienta.name);
            return new AIMessage("ok");
          },
        );
        return nombres;
      };
      expect(await visibles(primera)).toEqual(["buscar_herramientas"]);
      await primera.buscar.invoke({ herramientas: ["consultar_tickets"] });
      expect(await visibles(primera)).toEqual([
        "buscar_herramientas",
        "consultar_tickets",
      ]);
      expect(await visibles(segunda)).toEqual(["buscar_herramientas"]);
      await expect(
        primera.buscar.invoke({ herramientas: ["inexistente"] }),
      ).rejects.toThrow();
    } finally {
      base.close();
    }
  });
});
