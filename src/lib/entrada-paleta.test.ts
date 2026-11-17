import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { buscarEntrada, prepararEntrada, recibirPaleta, resumirEntradas } from "./entrada-paleta.ts";
import { PALETA_DE_PRUEBA, guardarDashboard, type OrigenRemoto } from "./paleta-remota.ts";
import { cruzarConToken, partirToken } from "./token-paleta.ts";

function origenVacio(): OrigenRemoto {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paleta-"));
  return { archivo: path.join(dir, "dashboard-remoto.json") };
}

test("el token de la foto se parte en código y lote", () => {
  const partes = partirToken("  plt-mpcm01009-1009111126-6-59651802 \n");
  assert.equal(partes.ok, true);
  if (!partes.ok) return;
  assert.equal(partes.value.token, PALETA_DE_PRUEBA.token);
  assert.equal(partes.value.codigo, "MPCM01009");
  assert.equal(partes.value.lote, "1009111126");
});

test("un código distinto al del token no se puede registrar", () => {
  const partes = partirToken(PALETA_DE_PRUEBA.token);
  assert.equal(partes.ok, true);
  if (!partes.ok) return;
  const cruce = cruzarConToken(partes.value, { ...PALETA_DE_PRUEBA, codigo: "MPCM99999" });
  assert.equal(cruce.ok, false);
});

test("la entrada guarda la copia y avisa al otro dashboard una sola vez", async () => {
  const db = await basePrueba();
  const origen = origenVacio();
  guardarDashboard({ responde: true, paletas: [{ ...PALETA_DE_PRUEBA }] }, origen);

  const entrada = await recibirPaleta(db, PALETA_DE_PRUEBA.token, "ana", origen, "2026-11-17");
  assert.equal(entrada.ok, true);
  if (!entrada.ok) return;
  assert.equal(entrada.value.producto, "SAL CON YODO Y FLUOR");
  assert.equal(entrada.value.kg, 1000);
  assert.equal(entrada.value.vencimiento, "2030-12-07");
  assert.equal(entrada.value.usuario, "ana");

  const archivo = JSON.parse(fs.readFileSync(origen.archivo, "utf8")) as { paletas: { recibidaEn: string }[] };
  assert.equal(archivo.paletas[0]?.recibidaEn, "2026-11-17");

  const otra = await recibirPaleta(db, PALETA_DE_PRUEBA.token, "ana", origen, "2026-11-17");
  assert.equal(otra.ok, false);
  assert.equal((await resumirEntradas(db)).paletas, 1);
  assert.equal((await buscarEntrada(db, PALETA_DE_PRUEBA.token))?.kg, 1000);

  const preparada = await prepararEntrada(db, PALETA_DE_PRUEBA.token, origen);
  assert.equal(preparada.ok && preparada.yaRegistrada, true);
});

test("si el otro dashboard no responde, no queda entrada", async () => {
  const db = await basePrueba();
  const origen = origenVacio();
  guardarDashboard({ responde: false, paletas: [{ ...PALETA_DE_PRUEBA }] }, origen);
  const entrada = await recibirPaleta(db, PALETA_DE_PRUEBA.token, "ana", origen, "2026-11-17");
  assert.equal(entrada.ok, false);
  assert.equal(await buscarEntrada(db, PALETA_DE_PRUEBA.token), undefined);
});

test("un token desconocido no se registra", async () => {
  const db = await basePrueba();
  const origen = origenVacio();
  guardarDashboard({ responde: true, paletas: [{ ...PALETA_DE_PRUEBA }] }, origen);
  const entrada = await recibirPaleta(db, "PLT-MPCM01009-1009111126-1-1", "ana", origen, "2026-11-17");
  assert.equal(entrada.ok, false);
  assert.equal((await resumirEntradas(db)).paletas, 0);
});
