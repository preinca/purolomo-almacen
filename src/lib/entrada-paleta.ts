import type { Db } from "./db";
import { fechaHoy } from "./formato";
import type { Resultado } from "./lotes";
import { consultarPaleta, liberarRecibida, marcarRecibida, type OrigenRemoto, origenLocal } from "./paleta-remota";
import { cruzarConToken, partirToken, type DatosPaleta } from "./token-paleta";

export type EntradaPaleta = DatosPaleta & {
  fecha: string;
  usuario: string;
  creadoEn: string;
};

const TABLA = `
CREATE TABLE IF NOT EXISTS entradas_paleta (
  token TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,
  producto TEXT NOT NULL,
  kg DOUBLE PRECISION NOT NULL CHECK (kg > 0),
  lote TEXT NOT NULL,
  vencimiento TEXT NOT NULL,
  fecha TEXT NOT NULL,
  usuario TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);
CREATE INDEX IF NOT EXISTS idx_entradas_paleta_fecha ON entradas_paleta (fecha DESC, creado_en DESC);
`;

type Fila = Record<string, unknown>;

function fila(row: Fila): EntradaPaleta {
  return {
    token: String(row.token),
    codigo: String(row.codigo),
    producto: String(row.producto),
    kg: Number(row.kg),
    lote: String(row.lote),
    vencimiento: String(row.vencimiento),
    fecha: String(row.fecha),
    usuario: String(row.usuario ?? ""),
    creadoEn: String(row.creado_en),
  };
}

export async function asegurarEntradas(db: Db) {
  await db.exec(TABLA);
}

export async function buscarEntrada(db: Db, token: string) {
  await asegurarEntradas(db);
  const row = await db.get<Fila>("SELECT * FROM entradas_paleta WHERE token = ?", token);
  return row ? fila(row) : undefined;
}

export async function listarEntradas(db: Db, limite = 20) {
  await asegurarEntradas(db);
  const pedido = Number.isFinite(limite) ? limite : 20;
  const tope = Math.min(Math.max(Math.trunc(pedido), 1), 500);
  const filas = await db.all<Fila>(
    "SELECT * FROM entradas_paleta ORDER BY creado_en DESC, token DESC LIMIT ?",
    tope,
  );
  return filas.map(fila);
}

/** Tope del historial, el mismo que usa producción para las recepciones recientes. */
export const LIMITE_HISTORIAL_ENTRADAS = 300;

export async function listarHistorialEntradas(db: Db) {
  return listarEntradas(db, LIMITE_HISTORIAL_ENTRADAS);
}

export async function resumirEntradas(db: Db) {
  await asegurarEntradas(db);
  const row = await db.get<{ n: number; kg: number }>(
    "SELECT COUNT(*)::int AS n, COALESCE(SUM(kg), 0) AS kg FROM entradas_paleta",
  );
  return { paletas: Number(row?.n ?? 0), kg: Number(row?.kg ?? 0) };
}

export type PreparacionPaleta =
  | { ok: true; yaRegistrada: false; paleta: DatosPaleta }
  | { ok: true; yaRegistrada: true; paleta: EntradaPaleta }
  | { ok: false; error: string };

export async function prepararEntrada(
  db: Db,
  tokenTexto: string,
  origen: OrigenRemoto = origenLocal(),
): Promise<PreparacionPaleta> {
  const partes = partirToken(tokenTexto);
  if (!partes.ok) return partes;
  const guardada = await buscarEntrada(db, partes.value.token);
  if (guardada) return { ok: true, yaRegistrada: true, paleta: guardada };
  const remota = await consultarPaleta(partes.value.token, origen);
  if (!remota.ok) return remota;
  const cruzada = cruzarConToken(partes.value, remota.value);
  if (!cruzada.ok) return cruzada;
  return { ok: true, yaRegistrada: false, paleta: cruzada.value };
}

/**
 * Consulta de nuevo, avisa al otro dashboard y guarda la copia local.
 * Si el aviso falla, la entrada no queda registrada.
 */
export async function recibirPaleta(
  db: Db,
  tokenTexto: string,
  usuario: string,
  origen: OrigenRemoto = origenLocal(),
  fecha = fechaHoy(),
): Promise<Resultado<EntradaPaleta>> {
  const preparada = await prepararEntrada(db, tokenTexto, origen);
  if (!preparada.ok) return preparada;
  if (preparada.yaRegistrada) return { ok: false, error: "Esta paleta ya está registrada." };

  const paleta = preparada.paleta;
  const avisada = await marcarRecibida(paleta.token, fecha, origen);
  if (!avisada.ok) return avisada;

  const cambios = await db.run(
    `INSERT INTO entradas_paleta (token, codigo, producto, kg, lote, vencimiento, fecha, usuario)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (token) DO NOTHING`,
    paleta.token,
    paleta.codigo,
    paleta.producto,
    paleta.kg,
    paleta.lote,
    paleta.vencimiento,
    fecha,
    usuario,
  );
  if (cambios === 0) return { ok: false, error: "Esta paleta ya está registrada." };
  const guardada = await buscarEntrada(db, paleta.token);
  if (!guardada) {
    await liberarRecibida(paleta.token, origen);
    return { ok: false, error: "No se pudo guardar la entrada." };
  }
  return { ok: true, value: guardada };
}
