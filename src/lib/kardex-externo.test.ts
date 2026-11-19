import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, test } from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { buscarEntrada, listarInventarioPaletas, prepararEntrada, recibirPaleta, recibirPaletaManual } from "./entrada-paleta.ts";
import { olvidarSesionKardex, buscarPaletaKardex } from "./kardex-externo.ts";
import { PALETA_DE_PRUEBA, guardarDashboard, type OrigenRemoto } from "./paleta-remota.ts";
import os from "node:os";
import path from "node:path";

const BASE = "https://kardex.test";
const CLAVE = "clave-externa";
const TOKEN = PALETA_DE_PRUEBA.token;

type Llamada = {
  url: string;
  method: string;
  redirect: RequestRedirect | undefined;
  headers: Headers;
  body: string;
};

function origenVacio(): OrigenRemoto {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paleta-"));
  return { archivo: path.join(dir, "dashboard-remoto.json") };
}

function login(cookie: string) {
  return new Response(null, {
    status: 302,
    headers: {
      location: `${BASE}/`,
      "set-cookie": `session=${cookie}; HttpOnly; Path=/`,
    },
  });
}

function json(datos: unknown, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function paleta(cantidad: unknown, extra: Record<string, unknown> = {}) {
  return {
    success: true,
    codigo: "MPCM01009",
    descripcion: "SAL CON YODO Y FLUOR",
    lote: "1009111126",
    fv: "2030-12-07",
    cantidad,
    ...extra,
  };
}

function configurar() {
  process.env.KARDEX_EXTERNO_URL = BASE;
  process.env.KARDEX_EXTERNO_USUARIO = "almacen";
  process.env.KARDEX_EXTERNO_CLAVE = CLAVE;
}

function limpiarEntorno() {
  delete process.env.KARDEX_EXTERNO_URL;
  delete process.env.KARDEX_EXTERNO_USUARIO;
  delete process.env.KARDEX_EXTERNO_CLAVE;
  olvidarSesionKardex();
}

async function leerCuerpo(body: BodyInit | null | undefined) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  return "";
}

describe("kárdex externo", { concurrency: false }, () => {
  test("entra, consulta el token y reutiliza la cookie", async (t) => {
    const original = globalThis.fetch;
    const llamadas: Llamada[] = [];
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const llamada: Llamada = {
        url,
        method: init?.method ?? "GET",
        redirect: init?.redirect,
        headers: new Headers(init?.headers),
        body: await leerCuerpo(init?.body ?? null),
      };
      llamadas.push(llamada);
      if (url.endsWith("/login")) return login("cookie-de-prueba");
      return json(paleta("1000.0 KG", { nueva_integrada: true, mensaje: "Paleta integrada." }));
    }) as typeof fetch;

    const primera = await buscarPaletaKardex(`  ${TOKEN.toLowerCase()} \n`);
    const segunda = await buscarPaletaKardex(TOKEN);

    assert.equal(primera.ok, true);
    assert.equal(segunda.ok, true);
    if (!primera.ok || !segunda.ok) return;
    assert.equal(primera.value.codigo, "MPCM01009");
    assert.equal(primera.value.descripcion, "SAL CON YODO Y FLUOR");
    assert.equal(primera.value.lote, "1009111126");
    assert.equal(primera.value.fv, "2030-12-07");
    assert.equal(primera.value.cantidad, 1000);
    assert.equal(primera.value.unidad, "KG");
    assert.equal(primera.value.nuevaIntegrada, true);
    assert.equal(primera.value.mensaje, "Paleta integrada.");
    assert.equal(JSON.stringify(primera).includes("cookie-de-prueba"), false);
    assert.equal(JSON.stringify(primera).includes(CLAVE), false);

    assert.equal(llamadas.filter((llamada) => llamada.url.endsWith("/login")).length, 1);
    const buscar = llamadas.filter((llamada) => llamada.url.endsWith("/api/palleta/buscar"));
    assert.equal(buscar.length, 2);
    assert.equal(buscar[0]?.headers.get("cookie"), "session=cookie-de-prueba");
    assert.equal(buscar[0]?.headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(buscar[0]?.body ?? "{}"), { token: TOKEN });
    assert.equal(llamadas[0]?.redirect, "manual");
    assert.equal(llamadas[0]?.headers.get("content-type"), "application/x-www-form-urlencoded");
    assert.equal(llamadas[0]?.body, `username=almacen&password=${CLAVE}`);
    assert.equal(llamadas.some((llamada) => llamada.url.includes("/api/paleta/")), false);
  });

  test("si la sesión venció, entra otra vez y reintenta una sola vez", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    const cookies = ["cookie-vieja", "cookie-nueva"];
    const búsquedas: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login(cookies.shift() ?? "sin-cookie");
      búsquedas.push(new Headers(init?.headers).get("cookie") ?? "");
      if (búsquedas.length === 1) {
        return new Response(null, { status: 302, headers: { location: `${BASE}/login` } });
      }
      return json(paleta(1000));
    }) as typeof fetch;

    const resultado = await buscarPaletaKardex(TOKEN);
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;
    assert.equal(resultado.value.cantidad, 1000);
    assert.equal(resultado.value.unidad, "KG");
    assert.deepEqual(búsquedas, ["session=cookie-vieja", "session=cookie-nueva"]);
    assert.equal(cookies.length, 0);
  });

  test("un HTML de login también obliga a entrar de nuevo", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    let busquedas = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-html");
      busquedas += 1;
      if (busquedas === 1) {
        return new Response("<!doctype html><html><body>login</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return json(paleta("1000,5 kg", { fv: "07/12/2030" }));
    }) as typeof fetch;

    const resultado = await buscarPaletaKardex(TOKEN);
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;
    assert.equal(resultado.value.cantidad, 1000.5);
    assert.equal(resultado.value.fv, "2030-12-07");
    assert.equal(busquedas, 2);
  });

  test("si la sesión sigue vencida, no reintenta sin parar", async (t) => {
    const original = globalThis.fetch;
    let logins = 0;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) {
        logins += 1;
        return login(`cookie-${logins}`);
      }
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    const resultado = await buscarPaletaKardex(TOKEN);
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;
    assert.equal(resultado.tipo, "caido");
    assert.match(resultado.error, /sesión/);
    assert.equal(logins, 2);
  });

  test("un token que el kárdex no tiene no se confunde con una caída", async (t) => {
    const original = globalThis.fetch;
    let llamadas = 0;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      llamadas += 1;
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-ok");
      return json({ success: false, error: "No se encontró la paleta" });
    }) as typeof fetch;

    const resultado = await buscarPaletaKardex(TOKEN);
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;
    assert.equal(resultado.tipo, "no_encontrado");
    assert.equal(resultado.error, "No se encontró la paleta");
    assert.equal(llamadas, 2);
  });

  test("si el kárdex no responde, el error lo dice y no hay cookie", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    const resultado = await buscarPaletaKardex(TOKEN);
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;
    assert.equal(resultado.tipo, "caido");
    assert.match(resultado.error, /no responde/);
    assert.equal(JSON.stringify(resultado).includes(CLAVE), false);
  });

  test("un tiempo de espera agotado también es el kárdex caído", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async () => {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    }) as typeof fetch;

    const resultado = await buscarPaletaKardex(TOKEN);
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;
    assert.equal(resultado.tipo, "caido");
    assert.match(resultado.error, /tardó demasiado/);
  });

  test("sin variables no llama al kárdex", async (t) => {
    const original = globalThis.fetch;
    let llamadas = 0;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    limpiarEntorno();
    globalThis.fetch = (async () => {
      llamadas += 1;
      throw new Error("no debía llamarse");
    }) as typeof fetch;

    const resultado = await buscarPaletaKardex(TOKEN);
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;
    assert.equal(resultado.tipo, "no_configurado");
    assert.equal(llamadas, 0);
  });

  test("con el kárdex, la entrada guarda lo que devolvió y no toca la copia local", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-entrada");
      return json(paleta(1000));
    }) as typeof fetch;

    const db = await basePrueba();
    const origen = origenVacio();
    const entrada = await recibirPaleta(db, TOKEN, "ana", origen, "2026-11-17", "", true);
    assert.equal(entrada.ok, true);
    if (!entrada.ok) return;
    assert.equal(entrada.value.producto, "SAL CON YODO Y FLUOR");
    assert.equal(entrada.value.kg, 1000);
    assert.equal(entrada.value.vencimiento, "2030-12-07");
    assert.equal(entrada.value.vencimientoNoAplica, false);
    assert.equal(fs.existsSync(origen.archivo), false);
  });

  test("si faltan código y lote en la respuesta, se completan con el token", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-parcial");
      return json({
        success: true,
        descripcion: "SAL CON YODO Y FLUOR",
        fv: "2030-12-07",
        cantidad: "1000.0 KG",
      });
    }) as typeof fetch;

    const preparada = await prepararEntrada(await basePrueba(), TOKEN, origenVacio());
    assert.equal(preparada.ok, true);
    if (!preparada.ok || preparada.yaRegistrada) return;
    assert.equal(preparada.origenDatos, "kardex");
    assert.equal(preparada.paleta.codigo, "MPCM01009");
    assert.equal(preparada.paleta.lote, "1009111126");
  });

  test("si el kárdex no tiene el token, no se usa la copia local", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-no");
      return json({ success: false, error: "No se encontró la paleta" });
    }) as typeof fetch;

    const db = await basePrueba();
    const origen = origenVacio();
    guardarDashboard({ responde: true, paletas: [{ ...PALETA_DE_PRUEBA }] }, origen);
    const entrada = await recibirPaleta(db, TOKEN, "ana", origen, "2026-11-17");
    assert.equal(entrada.ok, false);
    assert.equal(await buscarEntrada(db, TOKEN), undefined);
    const archivo = JSON.parse(fs.readFileSync(origen.archivo, "utf8")) as { paletas: { recibidaEn: string }[] };
    assert.equal(archivo.paletas[0]?.recibidaEn, "");
  });

  test("si el kárdex no responde, la entrada sigue con la copia local", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    const db = await basePrueba();
    const origen = origenVacio();
    guardarDashboard({ responde: true, paletas: [{ ...PALETA_DE_PRUEBA }] }, origen);
    const preparada = await prepararEntrada(db, TOKEN, origen);
    assert.equal(preparada.ok, true);
    if (!preparada.ok || preparada.yaRegistrada) return;
    assert.equal(preparada.origenDatos, "local");
    assert.match(preparada.aviso ?? "", /no responde/);

    const entrada = await recibirPaleta(db, TOKEN, "ana", origen, "2026-11-17");
    assert.equal(entrada.ok, true);
    const archivo = JSON.parse(fs.readFileSync(origen.archivo, "utf8")) as { paletas: { recibidaEn: string }[] };
    assert.equal(archivo.paletas[0]?.recibidaEn, "2026-11-17");
  });

  test("si tampoco hay copia local, se puede registrar a mano con el código y el lote del token", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    const db = await basePrueba();
    const origen = origenVacio();
    const token = "PLT-MPCM01009-1009111126-9-1";
    guardarDashboard({ responde: false, paletas: [{ ...PALETA_DE_PRUEBA }] }, origen);
    const preparada = await prepararEntrada(db, token, origen);
    assert.equal(preparada.ok, false);
    if (preparada.ok) return;
    assert.equal(preparada.manual?.codigo, "MPCM01009");
    assert.equal(preparada.manual?.lote, "1009111126");

    const entrada = await recibirPaletaManual(
      db,
      token,
      "ana",
      { producto: "SAL CON YODO Y FLUOR", kg: "1000,5", vencimiento: "2030-12-07" },
      origen,
      "2026-11-17",
    );
    assert.equal(entrada.ok, true);
    if (!entrada.ok) return;
    assert.equal(entrada.value.codigo, "MPCM01009");
    assert.equal(entrada.value.lote, "1009111126");
    assert.equal(entrada.value.kg, 1000.5);
    assert.equal(entrada.value.producto, "SAL CON YODO Y FLUOR");
  });

  test("la respuesta real sin lote ni vencimiento no es un error", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    const respuestaReal = {
      cantidad: 1000.0,
      codigo: "MPCM01009",
      descripcion: "SAL CON YODO Y FLUOR",
      encontrado: true,
      success: true,
      token: TOKEN,
    };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-real");
      return json(respuestaReal);
    }) as typeof fetch;

    const leida = await buscarPaletaKardex(TOKEN);
    assert.equal(leida.ok, true);
    if (!leida.ok) return;
    assert.equal(leida.value.codigo, "MPCM01009");
    assert.equal(leida.value.descripcion, "SAL CON YODO Y FLUOR");
    assert.equal(leida.value.cantidad, 1000);
    assert.equal(leida.value.lote, "");
    assert.equal(leida.value.fv, "");

    const db = await basePrueba();
    const origen = origenVacio();
    const preparada = await prepararEntrada(db, TOKEN, origen);
    assert.equal(preparada.ok, true);
    if (!preparada.ok || preparada.yaRegistrada) return;
    assert.equal(preparada.faltaVencimiento, true);
    assert.equal(preparada.paleta.lote, "1009111126");
    assert.equal(preparada.paleta.codigo, "MPCM01009");
    assert.equal(preparada.paleta.kg, 1000);
    assert.match(preparada.aviso ?? "", /vencimiento/);

    const sinFecha = await recibirPaleta(db, TOKEN, "ana", origen, "2026-11-17");
    assert.equal(sinFecha.ok, false);
    if (sinFecha.ok) return;
    assert.match(sinFecha.error, /no aplica/);
    assert.equal(await buscarEntrada(db, TOKEN), undefined);

    const entrada = await recibirPaleta(db, TOKEN, "ana", origen, "2026-11-17", "2030-12-07");
    assert.equal(entrada.ok, true);
    if (!entrada.ok) return;
    assert.equal(entrada.value.vencimiento, "2030-12-07");
    assert.equal(entrada.value.vencimientoNoAplica, false);
    assert.equal(entrada.value.lote, "1009111126");
    assert.equal(entrada.value.producto, "SAL CON YODO Y FLUOR");
    assert.equal(fs.existsSync(origen.archivo), false);
  });

  test("sin vencimiento se guarda como no aplica y el inventario lo deja al final", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-empaque");
      return json({
        cantidad: 20,
        codigo: "MPCM01009",
        descripcion: "BOLSA",
        encontrado: true,
        success: true,
        token: TOKEN,
      });
    }) as typeof fetch;

    const db = await basePrueba();
    const origen = origenVacio();
    await db.run(
      `INSERT INTO entradas_paleta (token, codigo, producto, kg, lote, vencimiento, fecha, usuario)
       VALUES ('PLT-ANTES', 'EMP01', 'CAJA', 8, 'L', '2026-06-01', '2026-11-01', 'ana')`,
    );
    const entrada = await recibirPaleta(db, TOKEN, "ana", origen, "2026-11-17", "", true);
    assert.equal(entrada.ok, true);
    if (!entrada.ok) return;
    assert.equal(entrada.value.vencimiento, "");
    assert.equal(entrada.value.vencimientoNoAplica, true);
    const cruda = await db.get<{ vencimiento: string | null; vencimiento_no_aplica: number }>(
      "SELECT vencimiento, vencimiento_no_aplica FROM entradas_paleta WHERE token = ?",
      TOKEN,
    );
    assert.equal(cruda?.vencimiento ?? null, null);
    assert.equal(Number(cruda?.vencimiento_no_aplica), 1);
    const inventario = await listarInventarioPaletas(db);
    assert.deepEqual(
      inventario.map((fila) => fila.token),
      ["PLT-ANTES", TOKEN],
    );
  });

  test("encontrado en falso es un token que el kárdex no tiene", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-no");
      return json({
        success: true,
        encontrado: false,
        codigo: "MPCM01009",
        descripcion: "SAL CON YODO Y FLUOR",
        cantidad: 1000,
        error: "Paleta no registrada",
      });
    }) as typeof fetch;

    const resultado = await buscarPaletaKardex(TOKEN);
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;
    assert.equal(resultado.tipo, "no_encontrado");
    assert.equal(resultado.error, "Paleta no registrada");
  });

  test("lee el vencimiento día primero y deja en blanco el que no se entiende", async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
      limpiarEntorno();
    });
    configurar();
    olvidarSesionKardex();
    const casos: Array<[unknown, string]> = [
      ["07/12/2030", "2030-12-07"],
      ["07-12-2030", "2030-12-07"],
      ["2030-12-07", "2030-12-07"],
      ["2030-12-07T14:30:00", "2030-12-07"],
      ["07/12/2030 08:30", "2030-12-07"],
      ["7/12/2030", "2030-12-07"],
      ["01/13/2030", ""],
      [null, ""],
      ["", ""],
      ["no-es-fecha", ""],
    ];
    let pendiente = casos[0]?.[0];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/login")) return login("cookie-fechas");
      return json(paleta(1000, { fv: pendiente }));
    }) as typeof fetch;

    for (const [entrada, esperada] of casos) {
      pendiente = entrada;
      olvidarSesionKardex();
      const resultado = await buscarPaletaKardex(TOKEN);
      assert.equal(resultado.ok, true, `fv ${String(entrada)}`);
      if (!resultado.ok) return;
      assert.equal(resultado.value.fv, esperada, `fv ${String(entrada)}`);
    }
  });
});
