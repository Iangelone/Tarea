import type { Clasificacion } from "./clasificacion.js";

// Simula una clasificación con reglas simples; no utiliza un modelo de IA.
export function clasificarMock(texto: string): Clasificacion {
  // Normaliza el texto para reconocer palabras con o sin acentos.
  const reclamo = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  let categoria: Clasificacion["categoria"] = "otros";
  if (/seguridad|filtracion|phishing|hackeo/.test(reclamo)) {
    categoria = "seguridad";
  } else if (/factura|facturacion|cobro|pago/.test(reclamo)) {
    categoria = "facturacion";
  } else if (/acceso|ingresar|contrasena|iniciar sesion/.test(reclamo)) {
    categoria = "acceso";
  } else if (/error|falla|no funciona/.test(reclamo)) {
    categoria = "soporte_tecnico";
  }

  let prioridad: Clasificacion["prioridad"] = "media";
  if (/servicio caido|todos los usuarios|filtracion/.test(reclamo)) {
    prioridad = "critica";
  } else if (/urgente|bloqueante/.test(reclamo)) {
    prioridad = "alta";
  } else if (/consulta|sin urgencia/.test(reclamo)) {
    prioridad = "baja";
  }

  return { categoria, prioridad };
}
