import assert from "node:assert/strict";
import test from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { recibirPaleta } from "./entrada-paleta.ts";
import { anularDosificacion, consultarProductoDosificacion, guardarDosificacion, kgDisponiblesDeToken, listarDosificaciones, pesoTotalPaleta } from "./dosificacion.ts";
import { listarHistorialSalidas } from "./lotes.ts";
import { PALETA_DE_PRUEBA, guardarDashboard, type OrigenRemoto } from "./paleta-remota.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("el peso total es peso unitario por cantidad", () => {
  assert.equal(pesoTotalPaleta(1.25, 8), 10);
  assert.equal(pesoTotalPaleta(0, 8), null);
  assert.equal(pesoTotalPaleta(1.5, 1.5), null);
});

test("la dosificación usa la entrada ya registrada y guarda el peso total", async () => {
  const db = await basePrueba();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dosi-"));
  const origen: OrigenRemoto = { archivo: path.join(dir, "dashboard.json") };
  guardarDashboard({ responde: true, paletas: [{ ...PALETA_DE_PRUEBA }] }, origen);
  const entrada = await recibirPaleta(db, PALETA_DE_PRUEBA.token, "ana", origen, "2026-11-17");
  assert.equal(entrada.ok, true);

  const producto = await consultarProductoDosificacion(db, PALETA_DE_PRUEBA.token);
  assert.equal(producto.ok, true);
  if (!producto.ok) return;
  assert.equal(producto.value.origen, "entrada");
  assert.equal(producto.value.codigo, "MPCM01009");
  assert.equal(producto.value.descripcion, "SAL CON YODO Y FLUOR");

  const guardada = await guardarDosificacion(
    db,
    {
      token: producto.value.token,
      codigo: producto.value.codigo,
      descripcion: producto.value.descripcion,
      nucleo: "N-12",
      pesoUnitario: 2.5,
      cantidad: 4,
      destino: "produccion",
    },
    "ana",
  );
  assert.equal(guardada.ok, true);
  if (!guardada.ok) return;
  assert.equal(guardada.value.pesoTotal, 10);
  assert.equal(guardada.value.nucleo, "N-12");
  assert.equal(guardada.value.destino, "produccion");
  assert.equal(guardada.value.destinoCodigo, "40602-1");
  const lista = await listarDosificaciones(db);
  assert.equal(lista[0]?.descripcion, "SAL CON YODO Y FLUOR");
  assert.equal(lista[0]?.cantidad, 4);
  assert.equal(await kgDisponiblesDeToken(db, PALETA_DE_PRUEBA.token), 990);

  const deMas = await guardarDosificacion(
    db,
    {
      token: producto.value.token,
      codigo: producto.value.codigo,
      descripcion: producto.value.descripcion,
      nucleo: "N-13",
      pesoUnitario: 500,
      cantidad: 3,
      destino: "makilas_san_pablo",
    },
    "ana",
  );
  assert.equal(deMas.ok, false);
  if (deMas.ok) return;
  assert.match(deMas.error, /Solo quedan/);

  const anulada = await anularDosificacion(db, guardada.value.id);
  assert.equal(anulada.ok, true);
  assert.equal(await kgDisponiblesDeToken(db, PALETA_DE_PRUEBA.token), 1000);
  const movimiento = await db.get<{ tipo: string; kg: number }>(
    "SELECT tipo, kg FROM movimientos WHERE dosificacion_id = ? AND tipo = 'consumo'",
    guardada.value.id,
  );
  assert.equal(movimiento?.tipo, "consumo");
  assert.equal(Number(movimiento?.kg), 10);

  const historial = await listarDosificaciones(db, 200);
  const fila = historial.find((item) => item.id === guardada.value.id);
  assert.equal(fila?.token, PALETA_DE_PRUEBA.token);
  assert.equal(fila?.codigo, "MPCM01009");
  assert.equal(fila?.descripcion, "SAL CON YODO Y FLUOR");
  assert.equal(fila?.nucleo, "N-12");
  assert.equal(fila?.pesoUnitario, 2.5);
  assert.equal(fila?.cantidad, 4);
  assert.equal(fila?.pesoTotal, 10);
  assert.equal(fila?.anulada, true);
  assert.equal(fila?.destino, "produccion");
  assert.equal(fila?.destinoCodigo, "40602-1");

  const sinDestino = await guardarDosificacion(
    db,
    {
      token: producto.value.token,
      codigo: producto.value.codigo,
      descripcion: producto.value.descripcion,
      nucleo: "N-14",
      pesoUnitario: 1,
      cantidad: 1,
      destino: "otra-planta",
    },
    "ana",
  );
  assert.equal(sinDestino.ok, false);
  if (sinDestino.ok) return;
  assert.match(sinDestino.error, /destino/);
  assert.equal(await kgDisponiblesDeToken(db, PALETA_DE_PRUEBA.token), 1000);
  const movimientos = await listarHistorialSalidas(db);
  assert.equal(
    movimientos.some((mov) => mov.nota.startsWith("Dosificación")),
    false,
  );
});
