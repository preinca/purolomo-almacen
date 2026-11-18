import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { buscarPaletaKardex, olvidarSesionKardex } from "./kardex-externo.ts";
import {
  atenderReporteUrl,
  leerReporteKardex,
  olvidarLimiteReporte,
  reporteExcedido,
} from "./reporte-kardex.ts";

const CLAVE = "clave-de-reporte";
const VALIDA = "https://abc-def.trycloudflare.com";

function peticion(url: string, autorizacion?: string, ip = "203.0.113.8") {
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": ip });
  if (autorizacion !== undefined) headers.set("authorization", autorizacion);
  return new Request("https://almacen.test/api/kardex-externo/url", {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });
}

describe("reporte de la URL del túnel", { concurrency: false }, () => {
  test("una clave inválida no guarda nada", async (t) => {
    const anterior = process.env.KARDEX_EXTERNO_REPORTE_CLAVE;
    t.after(() => {
      if (anterior === undefined) delete process.env.KARDEX_EXTERNO_REPORTE_CLAVE;
      else process.env.KARDEX_EXTERNO_REPORTE_CLAVE = anterior;
      olvidarLimiteReporte();
    });
    process.env.KARDEX_EXTERNO_REPORTE_CLAVE = CLAVE;
    olvidarLimiteReporte();
    const db = await basePrueba();

    const sinClave = await atenderReporteUrl(peticion(VALIDA), db);
    const mala = await atenderReporteUrl(peticion(VALIDA, "Bearer otra-clave"), db);
    assert.equal(sinClave.status, 401);
    assert.equal(mala.status, 401);
    assert.equal(await leerReporteKardex(db), null);
    assert.equal(JSON.stringify(await mala.json()).includes(CLAVE), false);
  });

  test("rechaza un host que no es el túnel permitido", async (t) => {
    const anterior = process.env.KARDEX_EXTERNO_REPORTE_CLAVE;
    t.after(() => {
      if (anterior === undefined) delete process.env.KARDEX_EXTERNO_REPORTE_CLAVE;
      else process.env.KARDEX_EXTERNO_REPORTE_CLAVE = anterior;
      olvidarLimiteReporte();
    });
    process.env.KARDEX_EXTERNO_REPORTE_CLAVE = CLAVE;
    olvidarLimiteReporte();
    const db = await basePrueba();
    const auth = `Bearer ${CLAVE}`;

    const ajena = await atenderReporteUrl(peticion("https://malicioso.example.com", auth), db);
    const http = await atenderReporteUrl(peticion("http://abc.trycloudflare.com", auth), db);
    const disfraz = await atenderReporteUrl(peticion("https://abc.trycloudflare.com.evil.com", auth), db);
    assert.equal(ajena.status, 400);
    assert.equal(http.status, 400);
    assert.equal(disfraz.status, 400);
    assert.equal(await leerReporteKardex(db), null);
  });

  test("guarda una URL https del túnel y el kárdex la usa antes que la variable", async (t) => {
    const anteriorClave = process.env.KARDEX_EXTERNO_REPORTE_CLAVE;
    const anteriorUrl = process.env.KARDEX_EXTERNO_URL;
    const anteriorUsuario = process.env.KARDEX_EXTERNO_USUARIO;
    const anteriorPass = process.env.KARDEX_EXTERNO_CLAVE;
    const fetchOriginal = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = fetchOriginal;
      if (anteriorClave === undefined) delete process.env.KARDEX_EXTERNO_REPORTE_CLAVE;
      else process.env.KARDEX_EXTERNO_REPORTE_CLAVE = anteriorClave;
      if (anteriorUrl === undefined) delete process.env.KARDEX_EXTERNO_URL;
      else process.env.KARDEX_EXTERNO_URL = anteriorUrl;
      if (anteriorUsuario === undefined) delete process.env.KARDEX_EXTERNO_USUARIO;
      else process.env.KARDEX_EXTERNO_USUARIO = anteriorUsuario;
      if (anteriorPass === undefined) delete process.env.KARDEX_EXTERNO_CLAVE;
      else process.env.KARDEX_EXTERNO_CLAVE = anteriorPass;
      olvidarLimiteReporte();
      olvidarSesionKardex();
    });

    process.env.KARDEX_EXTERNO_REPORTE_CLAVE = CLAVE;
    process.env.KARDEX_EXTERNO_URL = "https://desde-env.trycloudflare.com";
    process.env.KARDEX_EXTERNO_USUARIO = "almacen";
    process.env.KARDEX_EXTERNO_CLAVE = "clave-externa";
    olvidarLimiteReporte();
    olvidarSesionKardex();

    const db = await basePrueba();
    const respuesta = await atenderReporteUrl(
      peticion("https://ABC-DEF.trycloudflare.com/", `Bearer ${CLAVE}`),
      db,
    );
    assert.equal(respuesta.status, 200);
    const cuerpo = (await respuesta.json()) as { url: string };
    assert.equal(cuerpo.url, "https://abc-def.trycloudflare.com");

    const hosts: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      hosts.push(new URL(url).host);
      if (url.endsWith("/login")) {
        return new Response(null, {
          status: 302,
          headers: { location: `${new URL(url).origin}/`, "set-cookie": "session=cookie-base; HttpOnly; Path=/" },
        });
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: "No se encontró la paleta",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const consultada = await buscarPaletaKardex("PLT-MPCM01009-1009111126-6-59651802", db);
    assert.equal(consultada.ok, false);
    assert.equal(hosts[0], "abc-def.trycloudflare.com");
    assert.equal(hosts.some((host) => host === "desde-env.trycloudflare.com"), false);

    hosts.length = 0;
    const otra = await atenderReporteUrl(
      peticion("https://nueva-url.trycloudflare.com", `Bearer ${CLAVE}`, "203.0.113.9"),
      db,
    );
    assert.equal(otra.status, 200);
    await buscarPaletaKardex("PLT-MPCM01009-1009111126-6-59651802", db);
    assert.equal(hosts[0], "nueva-url.trycloudflare.com");
  });

  test("demasiados reportes seguidos se rechazan", async (t) => {
    const anterior = process.env.KARDEX_EXTERNO_REPORTE_CLAVE;
    t.after(() => {
      if (anterior === undefined) delete process.env.KARDEX_EXTERNO_REPORTE_CLAVE;
      else process.env.KARDEX_EXTERNO_REPORTE_CLAVE = anterior;
      olvidarLimiteReporte();
    });
    process.env.KARDEX_EXTERNO_REPORTE_CLAVE = CLAVE;
    olvidarLimiteReporte();
    for (let i = 0; i < 20; i += 1) assert.equal(reporteExcedido("203.0.113.10"), false);
    const db = await basePrueba();
    const respuesta = await atenderReporteUrl(peticion(VALIDA, `Bearer ${CLAVE}`, "203.0.113.10"), db);
    assert.equal(respuesta.status, 429);
    assert.equal(await leerReporteKardex(db), null);
  });
});
