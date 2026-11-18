import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { Db } from "./db";

const TABLA = `
CREATE TABLE IF NOT EXISTS kardex_externo_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  url TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
ALTER TABLE kardex_externo_config ENABLE ROW LEVEL SECURITY;
`;

const SUFIJO_POR_DEFECTO = ".trycloudflare.com";
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 20;

type Cubo = { desde: number; n: number };

const cubos = new Map<string, Cubo>();

export type ReporteKardex = {
  url: string;
  actualizadoEn: string;
};

export function olvidarLimiteReporte() {
  cubos.clear();
}

/** Como mucho 20 reportes por minuto y por dirección de quien llama. */
export function reporteExcedido(clave: string, ahora = Date.now()) {
  const cubo = cubos.get(clave);
  if (!cubo || ahora - cubo.desde >= VENTANA_MS) {
    cubos.set(clave, { desde: ahora, n: 1 });
    return false;
  }
  cubo.n += 1;
  return cubo.n > MAX_POR_VENTANA;
}

export function claveDeReporteValida(autorizacion: string | null) {
  const esperada = process.env.KARDEX_EXTERNO_REPORTE_CLAVE?.trim() ?? "";
  const recibida = bearer(autorizacion);
  if (!esperada || !recibida) return false;
  const a = createHash("sha256").update(esperada, "utf8").digest();
  const b = createHash("sha256").update(recibida, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function normalizarUrlReportada(cruda: string): { ok: true; url: string } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(cruda.trim());
  } catch {
    return { ok: false, error: "La dirección no es válida." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "La dirección tiene que ser https." };
  if (url.username || url.password || url.search || url.hash) {
    return { ok: false, error: "La dirección no está permitida." };
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return { ok: false, error: "La dirección no está permitida." };
  }
  const host = url.hostname.toLowerCase();
  if (!hostPermitido(host)) return { ok: false, error: "La dirección no está permitida." };
  return { ok: true, url: `https://${host}` };
}

export async function asegurarReporteKardex(db: Db) {
  await db.exec(TABLA);
}

export async function leerReporteKardex(db: Db): Promise<ReporteKardex | null> {
  await asegurarReporteKardex(db);
  const fila = await db.get<{ url: string; actualizado_en: string }>(
    "SELECT url, actualizado_en FROM kardex_externo_config WHERE id = 1",
  );
  if (!fila?.url) return null;
  return { url: String(fila.url), actualizadoEn: String(fila.actualizado_en) };
}

export async function guardarReporteKardex(db: Db, url: string, ahora = new Date()) {
  await asegurarReporteKardex(db);
  const anterior = await db.get<{ url: string }>("SELECT url FROM kardex_externo_config WHERE id = 1");
  const cambio = !anterior || String(anterior.url) !== url;
  const actualizadoEn = ahora.toISOString();
  await db.run(
    `INSERT INTO kardex_externo_config (id, url, actualizado_en) VALUES (1, ?, ?)
     ON CONFLICT (id) DO UPDATE SET url = excluded.url, actualizado_en = excluded.actualizado_en`,
    url,
    actualizadoEn,
  );
  if (cambio) {
    const { olvidarSesionKardex } = await import("./kardex-externo");
    olvidarSesionKardex();
  }
  return { url, actualizadoEn, cambio };
}

export async function atenderReporteUrl(request: Request, db: Db): Promise<Response> {
  if (reporteExcedido(clienteDe(request))) {
    return Response.json({ error: "Demasiados reportes. Espera un momento." }, { status: 429 });
  }
  if (!claveDeReporteValida(request.headers.get("authorization"))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const cuerpo = (await request.json().catch(() => null)) as { url?: unknown } | null;
  if (!cuerpo || typeof cuerpo.url !== "string") {
    return Response.json({ error: "Falta la dirección del túnel." }, { status: 400 });
  }
  const valida = normalizarUrlReportada(cuerpo.url);
  if (!valida.ok) return Response.json({ error: valida.error }, { status: 400 });
  const guardada = await guardarReporteKardex(db, valida.url);
  return Response.json({ ok: true, url: guardada.url, actualizadoEn: guardada.actualizadoEn });
}

function bearer(valor: string | null) {
  if (!valor) return "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(valor.trim());
  return match?.[1] ?? "";
}

function hostsPermitidos() {
  const crudo = process.env.KARDEX_EXTERNO_HOSTS_PERMITIDOS?.trim();
  if (!crudo) return [SUFIJO_POR_DEFECTO];
  return crudo
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function hostPermitido(host: string) {
  return hostsPermitidos().some((permitido) => {
    if (permitido.startsWith(".")) return host.endsWith(permitido) && host.length > permitido.length;
    return host === permitido;
  });
}

function clienteDe(request: Request) {
  const encabezado = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  const primero = encabezado.split(",")[0]?.trim();
  return primero || "local";
}
