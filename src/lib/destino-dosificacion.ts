export const DESTINOS_DOSIFICACION = ["purolomo", "makilas_san_pablo", "makilas_turmero"] as const;

export type DestinoDosificacion = (typeof DESTINOS_DOSIFICACION)[number];

export function esDestinoDosificacion(valor: string): valor is DestinoDosificacion {
  return (DESTINOS_DOSIFICACION as readonly string[]).includes(valor);
}

export function etiquetaDestino(destino: string | null | undefined) {
  if (destino === "purolomo") return "Purolomo";
  if (destino === "makilas_san_pablo") return "Makilas · San Pablo";
  if (destino === "makilas_turmero") return "Makilas · Turmero";
  return "—";
}
