// Opciones iniciales para clasificar reclamos de soporte.
export const categorias = [
  "acceso",
  "facturacion",
  "soporte_tecnico",
  "seguridad",
  "otros",
] as const;

export const prioridades = ["baja", "media", "alta", "critica"] as const;

export type Categoria = (typeof categorias)[number];
export type Prioridad = (typeof prioridades)[number];

export type Clasificacion = {
  categoria: Categoria;
  prioridad: Prioridad;
};
