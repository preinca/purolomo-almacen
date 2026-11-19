/** Un solo catálogo. El código se guarda en la dosificación al crearla. */
export const CATALOGO_DESTINOS = [
  { id: "produccion", nombre: "Producción", grupo: "raiz", codigo: "40602-1", detalle: "Dosificar para producción." },
  { id: "cerdo", nombre: "Cerdo", grupo: "raiz", codigo: "40602-3", detalle: "Dosificar para cerdo." },
  {
    id: "makilas_san_pablo",
    nombre: "San Pablo",
    grupo: "makilas",
    codigo: "60994",
    detalle: "Makilas, planta San Pablo.",
  },
  {
    id: "makilas_induproca",
    nombre: "Induproca",
    grupo: "makilas",
    codigo: "60993",
    detalle: "Makilas, planta Induproca.",
  },
  {
    id: "makilas_pev",
    nombre: "P.E.V",
    grupo: "makilas",
    codigo: "40644",
    detalle: "Planta Embutidos Valencia.",
  },
  {
    id: "makilas_sst",
    nombre: "Planta SST",
    grupo: "makilas",
    codigo: "60996",
    detalle: "Planta Santa Teresa.",
  },
] as const;

export type DestinoDosificacion = (typeof CATALOGO_DESTINOS)[number]["id"];

export function fichaDestino(id: string | null | undefined) {
  return CATALOGO_DESTINOS.find((destino) => destino.id === id);
}

export function esDestinoDosificacion(valor: string): valor is DestinoDosificacion {
  return fichaDestino(valor) !== undefined;
}

export function codigoDestino(id: string | null | undefined) {
  return fichaDestino(id)?.codigo ?? null;
}

/** «Producción · 40602-1» o «Makilas · San Pablo · 60994». El código guardado gana sobre el catálogo. */
export function textoDestino(id: string | null | undefined, codigoGuardado?: string | null) {
  const ficha = fichaDestino(id);
  if (!ficha) return "—";
  const nombre = ficha.grupo === "makilas" ? `Makilas · ${ficha.nombre}` : ficha.nombre;
  const codigo = (codigoGuardado ?? "").trim() || ficha.codigo;
  return codigo ? `${nombre} · ${codigo}` : nombre;
}

export const DESTINOS_RAIZ = CATALOGO_DESTINOS.filter((destino) => destino.grupo === "raiz");
export const DESTINOS_MAKILAS = CATALOGO_DESTINOS.filter((destino) => destino.grupo === "makilas");
