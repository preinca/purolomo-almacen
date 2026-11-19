import type { Db } from "./db";
import { fechaHoy, fechaValida } from "./formato";
import { buscarPaletaKardex, kardexEstaConfigurado } from "./kardex-externo";
import type { Resultado } from "./lotes";
import { consultarPaleta, liberarRecibida, marcarRecibida, type OrigenRemoto, origenLocal } from "./paleta-remota";
import { cruzarConToken, partirToken, type DatosPaleta, type PartesToken } from "./token-paleta";

export type EntradaPaleta = DatosPaleta & {
  fecha: string;
  usuario: string;
  creadoEn: string;
  kgDisponible?: number;
  vencimientoNoAplica: boolean;
};

const TABLA = `
CREATE TABLE IF NOT EXISTS entradas_paleta (
  token TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,
  producto TEXT NOT NULL,
  kg DOUBLE PRECISION NOT NULL CHECK (kg > 0),
  lote TEXT NOT NULL,
  vencimiento TEXT,
  vencimiento_no_aplica INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL,
  usuario TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);
CREATE INDEX IF NOT EXISTS idx_entradas_paleta_fecha ON entradas_paleta (fecha DESC, creado_en DESC);
ALTER TABLE entradas_paleta ADD COLUMN IF NOT EXISTS vencimiento_no_aplica INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entradas_paleta ALTER COLUMN vencimiento DROP NOT NULL;
ALTER TABLE entradas_paleta DROP CONSTRAINT IF EXISTS entradas_paleta_vencimiento_ok;
ALTER TABLE entradas_paleta ADD CONSTRAINT entradas_paleta_vencimiento_ok CHECK (
  (vencimiento_no_aplica = 0 AND vencimiento IS NOT NULL)
  OR (vencimiento_no_aplica = 1 AND vencimiento IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_entradas_paleta_fefo ON entradas_paleta (vencimiento_no_aplica, vencimiento);
`;

type Fila = Record<string, unknown>;

function fila(row: Fila): EntradaPaleta {
  return {
    token: String(row.token),
    codigo: String(row.codigo),
    producto: String(row.producto),
    kg: Number(row.kg),
    lote: String(row.lote),
    vencimiento: row.vencimiento == null ? "" : String(row.vencimiento),
    vencimientoNoAplica: Number(row.vencimiento_no_aplica) === 1,
    fecha: String(row.fecha),
    usuario: String(row.usuario ?? ""),
    creadoEn: String(row.creado_en),
    ...(row.kg_disponible === undefined ? {} : { kgDisponible: Number(row.kg_disponible) }),
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
  const { asegurarDosificaciones } = await import("./dosificacion");
  await asegurarDosificaciones(db);
  const pedido = Number.isFinite(limite) ? limite : 20;
  const tope = Math.min(Math.max(Math.trunc(pedido), 1), 500);
  const filas = await db.all<Fila>(
    `SELECT e.*,
       e.kg - COALESCE((
         SELECT SUM(d.peso_total) FROM dosificaciones d
         WHERE d.token = e.token AND d.anulada = 0
       ), 0) AS kg_disponible
     FROM entradas_paleta e
     ORDER BY e.creado_en DESC, e.token DESC
     LIMIT ?`,
    tope,
  );
  return filas.map(fila);
}

/** Tope del historial, el mismo que usa producción para las recepciones recientes. */
export const LIMITE_HISTORIAL_ENTRADAS = 300;

export async function listarHistorialEntradas(db: Db) {
  return listarEntradas(db, LIMITE_HISTORIAL_ENTRADAS);
}

/** Stock de paletas con kilos: primero lo que vence antes. Sin vencimiento queda al final. */
export async function listarInventarioPaletas(db: Db, limite = 100) {
  await asegurarEntradas(db);
  const { asegurarDosificaciones } = await import("./dosificacion");
  await asegurarDosificaciones(db);
  const pedido = Number.isFinite(limite) ? limite : 100;
  const tope = Math.min(Math.max(Math.trunc(pedido), 1), 500);
  const filas = await db.all<Fila>(
    `SELECT e.*,
       e.kg - COALESCE((
         SELECT SUM(d.peso_total) FROM dosificaciones d
         WHERE d.token = e.token AND d.anulada = 0
       ), 0) AS kg_disponible
     FROM entradas_paleta e
     WHERE e.kg - COALESCE((
       SELECT SUM(d.peso_total) FROM dosificaciones d
       WHERE d.token = e.token AND d.anulada = 0
     ), 0) > 0.001
     ORDER BY e.vencimiento_no_aplica ASC, e.vencimiento ASC NULLS LAST, e.token ASC
     LIMIT ?`,
    tope,
  );
  return filas.map(fila);
}

export async function resumirEntradas(db: Db) {
  await asegurarEntradas(db);
  const row = await db.get<{ n: number; kg: number }>(
    "SELECT COUNT(*)::int AS n, COALESCE(SUM(kg), 0) AS kg FROM entradas_paleta",
  );
  return { paletas: Number(row?.n ?? 0), kg: Number(row?.kg ?? 0) };
}

export type DatosManuales = {
  token: string;
  codigo: string;
  lote: string;
};

export type PreparacionPaleta =
  | {
      ok: true;
      yaRegistrada: false;
      paleta: DatosPaleta;
      origenDatos: "kardex" | "local";
      aviso?: string;
      faltaVencimiento?: boolean;
    }
  | { ok: true; yaRegistrada: true; paleta: EntradaPaleta }
  | { ok: false; error: string; manual?: DatosManuales };

type PaletaResuelta = {
  ok: true;
  paleta: DatosPaleta;
  fuente: "kardex" | "local" | "manual";
  aviso?: string;
};

type ConsultaResuelta =
  | { ok: true; paleta: DatosPaleta; fuente: "kardex" | "local"; aviso?: string }
  | { ok: false; error: string; manual?: DatosManuales };

export async function prepararEntrada(
  db: Db,
  tokenTexto: string,
  origen: OrigenRemoto = origenLocal(),
): Promise<PreparacionPaleta> {
  const partes = partirToken(tokenTexto);
  if (!partes.ok) return partes;
  const guardada = await buscarEntrada(db, partes.value.token);
  if (guardada) return { ok: true, yaRegistrada: true, paleta: guardada };
  const resuelta = await resolverPaleta(db, partes.value, origen);
  if (!resuelta.ok) return resuelta;
  const faltaVencimiento = !fechaValida(resuelta.paleta.vencimiento);
  const avisoFecha = faltaVencimiento
    ? "El kárdex no envió la fecha de vencimiento. Escríbela o marca que no aplica."
    : undefined;
  const aviso = [resuelta.aviso, avisoFecha].filter(Boolean).join(" ");
  return {
    ok: true,
    yaRegistrada: false,
    paleta: resuelta.paleta,
    origenDatos: resuelta.fuente,
    ...(aviso ? { aviso } : {}),
    ...(faltaVencimiento ? { faltaVencimiento: true } : {}),
  };
}

/**
 * Consulta de nuevo y guarda la copia local.
 * Si los datos salen de la copia local, avisa a ese registro; si el aviso falla, no queda entrada.
 * Los datos del kárdex externo solo se leen: no se llama a sus rutas de escritura.
 */
export async function recibirPaleta(
  db: Db,
  tokenTexto: string,
  usuario: string,
  origen: OrigenRemoto = origenLocal(),
  fecha = fechaHoy(),
  vencimientoEscrito?: string,
  noAplica = false,
): Promise<Resultado<EntradaPaleta>> {
  const partes = partirToken(tokenTexto);
  if (!partes.ok) return partes;
  const guardada = await buscarEntrada(db, partes.value.token);
  if (guardada) return { ok: false, error: "Esta paleta ya está registrada." };
  const resuelta = await resolverPaleta(db, partes.value, origen);
  if (!resuelta.ok) return { ok: false, error: resuelta.error };
  const elegida = resolverVencimiento(resuelta.paleta, vencimientoEscrito, noAplica);
  if (!elegida.ok) return elegida;
  return persistir(db, resuelta, usuario, origen, fecha, elegida.value);
}

/**
 * Solo cuando el kárdex está configurado y no responde, y la copia local tampoco tiene la paleta.
 * Si al confirmar el kárdex o la copia local ya responden, se guardan esos datos y no los escritos a mano.
 */
export async function recibirPaletaManual(
  db: Db,
  tokenTexto: string,
  usuario: string,
  campos: { producto: string; kg: number | string; vencimiento: string; noAplica?: boolean },
  origen: OrigenRemoto = origenLocal(),
  fecha = fechaHoy(),
): Promise<Resultado<EntradaPaleta>> {
  const partes = partirToken(tokenTexto);
  if (!partes.ok) return partes;
  if (!kardexEstaConfigurado()) {
    return { ok: false, error: "La entrada a mano solo se usa cuando el kárdex externo no responde." };
  }
  const guardada = await buscarEntrada(db, partes.value.token);
  if (guardada) return { ok: false, error: "Esta paleta ya está registrada." };

  const kardex = await buscarPaletaKardex(partes.value.token, db);
  if (kardex.ok) {
    const cruzada = cruzarKardex(partes.value, kardex.value);
    if (!cruzada.ok) return cruzada;
    const elegida = resolverVencimiento(cruzada.value, String(campos.vencimiento), campos.noAplica === true);
    if (!elegida.ok) return elegida;
    return persistir(db, { ok: true, paleta: cruzada.value, fuente: "kardex" }, usuario, origen, fecha, elegida.value);
  }
  if (kardex.tipo !== "caido") return { ok: false, error: kardex.error };

  const local = await resolverLocal(partes.value, origen);
  if (local.ok) {
    const elegida = resolverVencimiento(local.paleta, campos.vencimiento, campos.noAplica === true);
    if (!elegida.ok) return elegida;
    return persistir(db, local, usuario, origen, fecha, elegida.value);
  }

  const producto = campos.producto.trim().replace(/\s+/g, " ");
  const kg = kilosManuales(campos.kg);
  if (producto.length < 2 || producto.length > 200) return { ok: false, error: "Escribe el nombre del producto." };
  if (kg === null) return { ok: false, error: "Escribe los kilos de la paleta." };
  const paleta: DatosPaleta = {
    token: partes.value.token,
    codigo: partes.value.codigo,
    producto,
    kg,
    lote: partes.value.lote,
    vencimiento: "",
  };
  const elegida = resolverVencimiento(paleta, campos.vencimiento, campos.noAplica === true);
  if (!elegida.ok) return elegida;

  return persistir(
    db,
    { ok: true, paleta, fuente: "manual" },
    usuario,
    origen,
    fecha,
    elegida.value,
  );
}

async function resolverPaleta(db: Db, partes: PartesToken, origen: OrigenRemoto): Promise<ConsultaResuelta> {
  if (!kardexEstaConfigurado()) return resolverLocal(partes, origen);

  const kardex = await buscarPaletaKardex(partes.token, db);
  if (kardex.ok) {
    const cruzada = cruzarKardex(partes, kardex.value);
    if (!cruzada.ok) return cruzada;
    const aviso = kardex.value.nuevaIntegrada && kardex.value.mensaje ? kardex.value.mensaje : undefined;
    return { ok: true, paleta: cruzada.value, fuente: "kardex", ...(aviso ? { aviso } : {}) };
  }
  if (kardex.tipo !== "caido") return { ok: false, error: kardex.error };

  const local = await resolverLocal(partes, origen);
  if (local.ok) {
    return {
      ok: true,
      paleta: local.paleta,
      fuente: "local",
      aviso: `${kardex.error} Se usó la copia local de esta paleta.`,
    };
  }
  return {
    ok: false,
    error: `${kardex.error} Puedes completar el producto, los kilos y el vencimiento: el código y el lote salen del QR.`,
    manual: { token: partes.token, codigo: partes.codigo, lote: partes.lote },
  };
}

async function resolverLocal(partes: PartesToken, origen: OrigenRemoto): Promise<ConsultaResuelta> {
  const remota = await consultarPaleta(partes.token, origen);
  if (!remota.ok) return remota;
  const cruzada = cruzarConToken(partes, remota.value);
  if (!cruzada.ok) return cruzada;
  return { ok: true, paleta: cruzada.value, fuente: "local" };
}

function cruzarKardex(
  partes: PartesToken,
  remoto: { codigo: string; descripcion: string; lote: string; fv: string; cantidad: number },
) {
  return cruzarConToken(
    partes,
    {
      token: partes.token,
      codigo: remoto.codigo.trim() || partes.codigo,
      producto: remoto.descripcion,
      kg: remoto.cantidad,
      lote: remoto.lote.trim() || partes.lote,
      vencimiento: remoto.fv,
    },
    { sinVencimiento: true },
  );
}

type VencimientoElegido = { valor: string | null; noAplica: boolean };

function resolverVencimiento(paleta: DatosPaleta, escrito?: string, noAplica = false): Resultado<VencimientoElegido> {
  if (fechaValida(paleta.vencimiento)) return { ok: true, value: { valor: paleta.vencimiento, noAplica: false } };
  if (noAplica) return { ok: true, value: { valor: null, noAplica: true } };
  const vencimiento = (escrito ?? "").trim();
  if (fechaValida(vencimiento)) return { ok: true, value: { valor: vencimiento, noAplica: false } };
  return {
    ok: false,
    error: vencimiento
      ? "Escribe el vencimiento con el formato AAAA-MM-DD."
      : "Elige la fecha de vencimiento o marca que no aplica.",
  };
}

async function persistir(
  db: Db,
  resuelta: PaletaResuelta,
  usuario: string,
  origen: OrigenRemoto,
  fecha: string,
  vencimiento: VencimientoElegido,
): Promise<Resultado<EntradaPaleta>> {
  const paleta = resuelta.paleta;
  if (resuelta.fuente === "local") {
    const avisada = await marcarRecibida(paleta.token, fecha, origen);
    if (!avisada.ok) return avisada;
  }

  const cambios = await db.run(
    `INSERT INTO entradas_paleta (token, codigo, producto, kg, lote, vencimiento, fecha, usuario, vencimiento_no_aplica)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (token) DO NOTHING`,
    paleta.token,
    paleta.codigo,
    paleta.producto,
    paleta.kg,
    paleta.lote,
    vencimiento.valor,
    fecha,
    usuario,
    vencimiento.noAplica ? 1 : 0,
  );
  if (cambios === 0) return { ok: false, error: "Esta paleta ya está registrada." };
  const guardada = await buscarEntrada(db, paleta.token);
  if (!guardada) {
    if (resuelta.fuente === "local") await liberarRecibida(paleta.token, origen);
    return { ok: false, error: "No se pudo guardar la entrada." };
  }
  return { ok: true, value: guardada };
}

function kilosManuales(valor: number | string) {
  if (typeof valor === "number") {
    if (!Number.isFinite(valor) || valor <= 0) return null;
    return Math.round(valor * 1000) / 1000;
  }
  const limpio = valor.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const kilos = Number(limpio);
  if (!Number.isFinite(kilos) || kilos <= 0) return null;
  return Math.round(kilos * 1000) / 1000;
}
