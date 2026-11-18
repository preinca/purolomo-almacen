import "server-only";

import type { Db } from "./db";
import { fechaValida } from "./formato";
import { leerReporteKardex } from "./reporte-kardex";

/**
 * Cliente del dashboard Purolomo Kárdex (Flask). Solo lee: POST /login y
 * POST /api/palleta/buscar (doble L). No llama a rutas de escritura.
 *
 * La respuesta en vivo no se capturó. Se asume, por el JS del dashboard:
 * - `success` verdadero y `codigo`, `descripcion`, `lote`, `fv`, `cantidad`
 * - `cantidad` puede ser número o texto; el inventario hace parseFloat y la
 *   etiqueta impresa trae unidad (`1000.0 KG`)
 * - un punto solo es decimal (`1000.0` → 1000); la coma es decimal salvo que
 *   agrupe miles de 3 dígitos (`1,000` → 1000, `1000,5` → 1000.5)
 * - `fv` en `AAAA-MM-DD`; si viene `DD/MM/AAAA` se interpreta día/mes/año
 * - `nueva_integrada` y `mensaje` son opcionales
 *
 * La cookie `session` vive en memoria de este proceso (no es estado de un
 * usuario del almacén). Si el proceso arranca de nuevo, se vuelve a entrar.
 */

const TIMEOUT_MS = 8_000;

export type PaletaExterna = {
  codigo: string;
  descripcion: string;
  lote: string;
  fv: string;
  cantidad: number;
  unidad: string;
  nuevaIntegrada: boolean;
  mensaje: string;
};

export type TipoErrorKardex = "no_configurado" | "caido" | "no_encontrado" | "invalido";

export type ResultadoKardex =
  | { ok: true; value: PaletaExterna }
  | { ok: false; tipo: TipoErrorKardex; error: string };

type FalloKardex = Extract<ResultadoKardex, { ok: false }>;
type SesionLista = { ok: true; cookie: string };

type Config = {
  url: string;
  usuario: string;
  clave: string;
};

type SesionCache = {
  firma: string;
  cookie: string;
};

type Paso = { paso: "sesion" } | { paso: "listo"; resultado: ResultadoKardex };

let sesionCache: SesionCache | null = null;

/** Borra la cookie guardada. Los tests lo usan para no arrastrar una sesión. */
export function olvidarSesionKardex() {
  sesionCache = null;
}

/** Hay alguna variable del kárdex: hay que consultarlo, no seguir en silencio. */
export function kardexEstaConfigurado() {
  return Boolean(
    process.env.KARDEX_EXTERNO_URL?.trim() ||
      process.env.KARDEX_EXTERNO_USUARIO?.trim() ||
      process.env.KARDEX_EXTERNO_CLAVE?.trim(),
  );
}

export async function buscarPaletaKardex(token: string, db?: Db): Promise<ResultadoKardex> {
  const config = await leerConfig(db);
  if (!config.ok) return { ok: false, tipo: "no_configurado", error: config.error };

  const limpio = token.trim().toUpperCase().replace(/\s+/g, "");
  if (!limpio) return { ok: false, tipo: "no_encontrado", error: "Falta el token de la paleta." };

  let renovar = false;
  for (let intento = 0; intento < 2; intento += 1) {
    const sesion = await obtenerSesion(config.value, renovar);
    if (!sesion.ok) return sesion;
    const consulta = await consultar(config.value, sesion.cookie, limpio);
    if (consulta.paso === "listo") return consulta.resultado;
    if (sesionCache?.cookie === sesion.cookie) sesionCache = null;
    renovar = true;
  }

  sesionCache = null;
  return {
    ok: false,
    tipo: "caido",
    error: "El kárdex externo no aceptó la sesión. Vuelve a intentar.",
  };
}

async function leerConfig(db?: Db): Promise<{ ok: true; value: Config } | { ok: false; error: string }> {
  let cruda = "";
  if (db) {
    try {
      const guardada = await leerReporteKardex(db);
      if (guardada?.url) cruda = guardada.url;
    } catch {
      cruda = "";
    }
  }
  if (!cruda) cruda = process.env.KARDEX_EXTERNO_URL?.trim() ?? "";
  const usuario = process.env.KARDEX_EXTERNO_USUARIO?.trim() ?? "";
  const clave = process.env.KARDEX_EXTERNO_CLAVE ?? "";
  if (!cruda || !usuario || !clave.trim()) {
    return {
      ok: false,
      error: "El kárdex externo no está configurado. Faltan la dirección, el usuario o la clave.",
    };
  }

  let url: URL;
  try {
    url = new URL(cruda);
  } catch {
    return { ok: false, error: "La dirección del kárdex externo no es válida." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "La dirección del kárdex externo no es válida." };
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const base = url.toString().replace(/\/$/, "");
  return { ok: true, value: { url: base, usuario, clave } };
}

function firmaConfig(config: Config) {
  return `${config.url}\n${config.usuario}\n${config.clave}`;
}

async function obtenerSesion(config: Config, renovar: boolean): Promise<SesionLista | FalloKardex> {
  const firma = firmaConfig(config);
  if (!renovar && sesionCache?.firma === firma) return { ok: true, cookie: sesionCache.cookie };
  return iniciarSesion(config, firma);
}

async function iniciarSesion(config: Config, firma: string): Promise<SesionLista | FalloKardex> {
  const pedido = await pedir(`${config.url}/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html,application/xhtml+xml",
    },
    body: new URLSearchParams({ username: config.usuario, password: config.clave }),
  });
  if (!pedido.ok) return pedido.resultado;

  const respuesta = pedido.respuesta;
  if (respuesta.status >= 500) {
    return { ok: false, tipo: "caido", error: "El kárdex externo no respondió al iniciar sesión." };
  }

  const cookie = valorCookieSesion(respuesta);
  const location = respuesta.headers.get("location") ?? "";
  const redirige = respuesta.status >= 300 && respuesta.status < 400;
  if (!cookie || (redirige && apuntaALogin(location, config.url))) {
    return { ok: false, tipo: "no_configurado", error: "El kárdex externo rechazó el usuario o la clave." };
  }
  if (respuesta.status === 200) {
    const texto = await respuesta.text();
    if (/name=["']password["']/i.test(texto) && /name=["']username["']/i.test(texto)) {
      return { ok: false, tipo: "no_configurado", error: "El kárdex externo rechazó el usuario o la clave." };
    }
  } else if (!redirige) {
    return { ok: false, tipo: "caido", error: "El kárdex externo no respondió al iniciar sesión." };
  }

  sesionCache = { firma, cookie };
  return { ok: true, cookie };
}

async function consultar(config: Config, cookie: string, token: string): Promise<Paso> {
  const pedido = await pedir(`${config.url}/api/palleta/buscar`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      cookie: `session=${cookie}`,
    },
    body: JSON.stringify({ token }),
  });
  if (!pedido.ok) return { paso: "listo", resultado: pedido.resultado };

  const respuesta = pedido.respuesta;
  if (respuesta.status >= 500) {
    return {
      paso: "listo",
      resultado: {
        ok: false,
        tipo: "caido",
        error: "El kárdex externo no responde. Revisa la dirección o inténtalo de nuevo.",
      },
    };
  }
  if (respuesta.status === 401 || respuesta.status === 403 || (respuesta.status >= 300 && respuesta.status < 400)) {
    return { paso: "sesion" };
  }

  const tipo = respuesta.headers.get("content-type") ?? "";
  const texto = await respuesta.text();
  if (esHtml(tipo, texto)) {
    if (respuesta.status === 404) {
      return {
        paso: "listo",
        resultado: {
          ok: false,
          tipo: "caido",
          error: "El kárdex externo no tiene el servicio de consulta de paletas.",
        },
      };
    }
    return { paso: "sesion" };
  }

  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return {
      paso: "listo",
      resultado: {
        ok: false,
        tipo: "invalido",
        error: "El kárdex externo respondió en un formato que no se pudo leer.",
      },
    };
  }
  if (rechazoDeSesion(datos)) return { paso: "sesion" };
  return { paso: "listo", resultado: interpretar(datos) };
}

function interpretar(datos: unknown): ResultadoKardex {
  if (!esRegistro(datos)) {
    return { ok: false, tipo: "invalido", error: "El kárdex externo respondió sin los datos de la paleta." };
  }

  const fracaso = datos.success === false || datos.success === 0 || datos.success === "false" || datos.success === "0";
  const sinConfirmar = datos.success === undefined && typeof datos.error === "string" && !textoCampo(datos.codigo);
  if (fracaso || sinConfirmar) {
    const error = textoError(datos.error, "El kárdex externo no tiene esta paleta.");
    return { ok: false, tipo: "no_encontrado", error };
  }

  const exito = datos.success === undefined || datos.success === true || datos.success === 1 || datos.success === "true" || datos.success === "1";
  if (!exito) {
    return { ok: false, tipo: "invalido", error: "El kárdex externo respondió sin confirmar la paleta." };
  }
  return normalizar(datos);
}

function normalizar(datos: Record<string, unknown>): ResultadoKardex {
  const descripcion = textoCampo(datos.descripcion).replace(/\s+/g, " ");
  const codigo = textoCampo(datos.codigo).toUpperCase();
  const lote = textoCampo(datos.lote).toUpperCase();
  const fv = leerFecha(datos.fv);
  const cantidad = leerCantidad(datos.cantidad);

  if (!descripcion) {
    return { ok: false, tipo: "invalido", error: "El kárdex externo no envió el nombre del producto." };
  }
  if (!cantidad.ok) return { ok: false, tipo: "invalido", error: cantidad.error };
  if (!fv) {
    return { ok: false, tipo: "invalido", error: "El kárdex externo no envió una fecha de vencimiento válida." };
  }

  const mensaje = textoError(datos.mensaje, "");
  return {
    ok: true,
    value: {
      codigo,
      descripcion,
      lote,
      fv,
      cantidad: cantidad.kg,
      unidad: cantidad.unidad,
      nuevaIntegrada: esMarca(datos.nueva_integrada),
      mensaje: esMarca(datos.nueva_integrada) ? mensaje : "",
    },
  };
}

function leerCantidad(valor: unknown): { ok: true; kg: number; unidad: string } | { ok: false; error: string } {
  if (typeof valor === "number") {
    if (!Number.isFinite(valor) || valor <= 0) {
      return { ok: false, error: "El kárdex externo no envió los kilos de la paleta." };
    }
    return { ok: true, kg: redondear(valor), unidad: "KG" };
  }
  if (typeof valor !== "string") {
    return { ok: false, error: "El kárdex externo no envió los kilos de la paleta." };
  }

  const texto = valor.trim().replace(/\s+/g, " ");
  const match = /^(-?\d[\d.,]*)\s*([A-Za-zÁÉÍÓÚáéíóúÑñ]*)/.exec(texto);
  if (!match) return { ok: false, error: "El kárdex externo no envió los kilos de la paleta." };
  const cantidad = interpretarNumero(match[1]);
  if (cantidad === null || !(cantidad > 0)) {
    return { ok: false, error: "El kárdex externo no envió los kilos de la paleta." };
  }

  const unidad = (match[2] || "KG").toUpperCase();
  const kg = aKilos(cantidad, unidad);
  if (kg === null) {
    return { ok: false, error: `La cantidad vino en ${unidad} y aquí se registra en kilos.` };
  }
  return { ok: true, kg: redondear(kg), unidad };
}

/**
 * Un punto solo es decimal, igual que parseFloat del inventario (`1000.0`).
 * `1.000.000` (varios grupos de 3) sí son miles. La coma decimal es `1000,5`;
 * `1,000` y `1,000,000` son miles.
 */
function interpretarNumero(fragmento: string): number | null {
  if (!/^\d[\d.,]*$/.test(fragmento)) return null;
  const tieneComa = fragmento.includes(",");
  const tienePunto = fragmento.includes(".");
  let normal = fragmento;
  if (tieneComa && tienePunto) {
    const decimalEsComa = fragmento.lastIndexOf(",") > fragmento.lastIndexOf(".");
    const miles = decimalEsComa ? "." : ",";
    const decimal = decimalEsComa ? "," : ".";
    normal = fragmento.replaceAll(miles, "").replace(decimal, ".");
  } else if (tieneComa || (tienePunto && fragmento.split(".").length > 2)) {
    const separador = tieneComa ? "," : ".";
    const partes = fragmento.split(separador);
    const miles = partes.slice(1).every((parte) => parte.length === 3);
    normal = miles ? partes.join("") : `${partes[0]}.${partes.slice(1).join("")}`;
  }
  if (!/^\d+(\.\d+)?$/.test(normal)) return null;
  const valor = Number(normal);
  return Number.isFinite(valor) ? valor : null;
}

function aKilos(cantidad: number, unidad: string): number | null {
  if (unidad === "KG" || unidad === "KGS" || unidad === "KILO" || unidad === "KILOS") return cantidad;
  if (unidad === "G" || unidad === "GR" || unidad === "GRS" || unidad === "GRAMO" || unidad === "GRAMOS") {
    return cantidad / 1000;
  }
  return null;
}

function leerFecha(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const texto = String(valor).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) {
    const fecha = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return fechaValida(fecha) ? fecha : null;
  }
  const dmy = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(texto);
  if (!dmy) return null;
  const fecha = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return fechaValida(fecha) ? fecha : null;
}

function esMarca(valor: unknown) {
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor !== 0;
  if (typeof valor !== "string") return false;
  const texto = valor.trim().toLowerCase();
  return texto === "1" || texto === "true" || texto === "si" || texto === "sí" || texto === "yes";
}

function rechazoDeSesion(datos: unknown) {
  if (!esRegistro(datos)) return false;
  const confirmada = datos.success === true || datos.success === 1 || datos.success === "true" || datos.success === "1";
  if (confirmada) return false;
  const error = typeof datos.error === "string" ? datos.error : "";
  return /sesi[oó]n|login|autentic|no autorizado|unauthorized|forbidden/i.test(error);
}

function textoError(valor: unknown, porDefecto: string) {
  if (typeof valor !== "string") return porDefecto;
  const limpio = valor.replace(/[\r\n\t]+/g, " ").trim();
  if (!limpio || limpio.length > 300 || /[<>]/.test(limpio)) return porDefecto;
  return limpio;
}

function textoCampo(valor: unknown) {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return "";
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function esHtml(tipo: string, texto: string) {
  return /text\/html/i.test(tipo) || /^\s*<(!doctype|html)/i.test(texto);
}

function apuntaALogin(location: string, base: string) {
  try {
    const url = new URL(location, `${base}/`);
    return url.pathname === "/login" || url.pathname.startsWith("/login/");
  } catch {
    return /\/login(?:$|[/?#])/.test(location);
  }
}

function valorCookieSesion(respuesta: Response) {
  const lista = respuesta.headers.getSetCookie();
  const crudas = lista.length > 0 ? lista : partirSetCookie(respuesta.headers.get("set-cookie"));
  for (const cruda of crudas) {
    const match = /^session=([^;]+)/i.exec(cruda.trim());
    if (match?.[1]) return match[1];
  }
  return "";
}

function partirSetCookie(valor: string | null) {
  if (!valor) return [];
  return [valor];
}

function redondear(valor: number) {
  return Math.round(valor * 1000) / 1000;
}

async function pedir(
  url: string,
  init: RequestInit,
): Promise<{ ok: true; respuesta: Response } | { ok: false; resultado: FalloKardex }> {
  try {
    const respuesta = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { ok: true, respuesta };
  } catch (error) {
    const nombre = nombreError(error);
    if (nombre === "TimeoutError" || nombre === "AbortError") {
      return {
        ok: false,
        resultado: { ok: false, tipo: "caido", error: "El kárdex externo tardó demasiado en responder." },
      };
    }
    return {
      ok: false,
      resultado: {
        ok: false,
        tipo: "caido",
        error: "El kárdex externo no responde. Revisa la dirección o inténtalo de nuevo.",
      },
    };
  }
}

function nombreError(error: unknown): string {
  if (!(error instanceof Error)) return "";
  if (error.name === "TimeoutError" || error.name === "AbortError") return error.name;
  const causa = "cause" in error ? error.cause : undefined;
  if (causa instanceof Error && (causa.name === "TimeoutError" || causa.name === "AbortError")) return causa.name;
  return error.name;
}
