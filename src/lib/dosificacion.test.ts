import assert from "node:assert/strict";
import test from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { recibirPaleta } from "./entrada-paleta.ts";
import { consultarProductoDosificacion, guardarDosificacion, listarDosificaciones, pesoTotalPaleta } from "./dosificacion.ts";
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
    },
    "ana",
  );
  assert.equal(guardada.ok, true);
  if (!guardada.ok) return;
  assert.equal(guardada.value.pesoTotal, 10);
  assert.equal(guardada.value.nucleo, "N-12");
  const lista = await listarDosificaciones(db);
  assert.equal(lista[0]?.descripcion, "SAL CON YODO Y FLUOR");
  assert.equal(lista[0]?.cantidad, 4);
});
