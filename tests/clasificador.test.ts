import { describe, expect, it } from "vitest";
import { clasificarMock } from "../src/clasificador-mock.js";

describe("clasificador mock", () => {
  it.each([
    ["Olvidé mi contraseña", "acceso", "media"],
    ["Consulta sobre mi factura", "facturacion", "baja"],
    ["La aplicación no funciona, es urgente", "soporte_tecnico", "alta"],
    ["Hay una filtración de datos", "seguridad", "critica"],
    ["Quisiera dar una sugerencia", "otros", "media"],
  ] as const)("clasifica %s", (texto, categoria, prioridad) => {
    expect(clasificarMock(texto)).toEqual({ categoria, prioridad });
  });
});
