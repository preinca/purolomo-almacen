import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { cerrarSolicitud, crearPlan, guardarBatches, guardarSolicitado, prepararCalculadora, resultadoPlan } from "./calculadora-db.ts";
import { calcularMpnc, parseCsvRecetas, type BatchesDia, type FilaPlan, type RecetaCalc } from "./calculadora.ts";
import { basePrueba } from "./db-prueba.ts";

type Semilla = {
  productos_plan: { planta: string; nombre: string; receta_id: string; order: number }[];
  recetas: {
    id: string;
    nombre: string;
    planta: string;
    items: { codigo: string; nombre: string; kg_por_batch: number; tipo: string }[];
    empaque: { codigo: string; cantidad_por_batch: number | null }[];
  }[];
  example_week16: {
    semana: number;
    batches_plan: { order: number; lunes: number; martes: number; miercoles: number; jueves: number; viernes: number }[];
    totales: { codigo: string; cantidad: number }[];
  };
};

const semilla = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "seed-calculadora.json"), "utf8"),
) as Semilla;

test("la semana de ejemplo coincide con los totales de la semilla", () => {
  const filas: FilaPlan[] = semilla.productos_plan.map((fila) => ({
    orden: fila.order,
    planta: fila.planta,
    nombre: fila.nombre,
    recetaId: fila.receta_id,
  }));
  const recetas: RecetaCalc[] = semilla.recetas.map((receta) => ({
    id: receta.id,
    nombre: receta.nombre,
    planta: receta.planta,
    items: receta.items.map((item) => ({
      codigo: item.codigo,
      nombre: item.nombre,
      kgPorBatch: item.kg_por_batch,
    })),
    empaque: [],
  }));
  const porFila = new Map<number, BatchesDia>();
  for (const fila of semilla.example_week16.batches_plan) {
    porFila.set(fila.order, {
      lunes: fila.lunes,
      martes: fila.martes,
      miercoles: fila.miercoles,
      jueves: fila.jueves,
      viernes: fila.viernes,
    });
  }

  const totales = calcularMpnc(filas, recetas, porFila);
  const porCodigo = new Map(totales.map((total) => [total.codigo, total.cantidad]));
  assert.equal(semilla.example_week16.semana, 45);
  for (const esperado of semilla.example_week16.totales) {
    const cantidad = porCodigo.get(esperado.codigo);
    assert.equal(cantidad !== undefined, true, esperado.codigo);
    assert.ok(Math.abs((cantidad ?? 0) - esperado.cantidad) < 0.001, `${esperado.codigo}: ${cantidad} ≠ ${esperado.cantidad}`);
  }
  assert.equal(porCodigo.get("MPCM01004"), 323.812);
  assert.equal(porCodigo.has("MPCM01182"), false);
  assert.equal(porCodigo.get("MPCM01059"), 120.67);
  assert.equal(porCodigo.get("MPCM01011"), 187.596);
  assert.equal(porCodigo.get("MPCM01009"), 9435.46);
});

test("la semilla en la base reproduce la semana 45", async () => {
  const db = await basePrueba();
  await prepararCalculadora(db);
  const creado = await crearPlan(db, 2026, 45, "ana");
  assert.equal(creado.ok, true);
  if (!creado.ok) return;
  const semillaLocal = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "seed-calculadora.json"), "utf8"),
  ) as Semilla;
  await guardarBatches(
    db,
    creado.id,
    semillaLocal.example_week16.batches_plan.map((fila) => ({
      orden: fila.order,
      batches: {
        lunes: fila.lunes,
        martes: fila.martes,
        miercoles: fila.miercoles,
        jueves: fila.jueves,
        viernes: fila.viernes,
      },
    })),
    "ana",
  );
  const resultado = await resultadoPlan(db, creado.id);
  assert.ok(resultado);
  const sal = resultado?.mpnc.find((fila) => fila.codigo === "MPCM01009");
  assert.equal(sal?.cantidad, 9435.46);
  const carmin = resultado?.mpnc.find((fila) => fila.codigo === "MPCM01004");
  assert.equal(carmin?.cantidad, 323.812);
  assert.equal(resultado?.mpnc.some((fila) => fila.codigo === "MPCM01182"), false);
  const benzoato = resultado?.mpnc.find((fila) => fila.codigo === "MPCM01059");
  assert.equal(benzoato?.cantidad, 120.67);
});

test("una solicitud guardada no se vuelve a editar", async () => {
  const db = await basePrueba();
  await prepararCalculadora(db);
  const creado = await crearPlan(db, 2026, 12, "ana");
  assert.equal(creado.ok, true);
  if (!creado.ok) return;
  const cerrado = await cerrarSolicitud(
    db,
    creado.id,
    [{ orden: 1, batches: { lunes: 2, martes: 0, miercoles: 0, jueves: 0, viernes: 0 } }],
    [{ codigo: "MPCM01009", tipo: "mpnc", cantidad: 10 }],
    "ana",
  );
  assert.equal(cerrado.ok, true);
  const resultado = await resultadoPlan(db, creado.id);
  assert.equal(resultado?.mpnc.find((fila) => fila.codigo === "MPCM01009")?.solicitada, 10);
  const batches = await guardarBatches(db, creado.id, [], "ana");
  assert.equal(batches.ok, false);
  const pedido = await guardarSolicitado(db, creado.id, "CAJA", "empaque", 4);
  assert.equal(pedido.ok, false);
  const otra = await cerrarSolicitud(db, creado.id, [], [], "ana");
  assert.equal(otra.ok, false);
});

test("un carmín guardado como MPCM01182 se suma en MPCM01004", () => {
  const filas: FilaPlan[] = [{ orden: 1, planta: "SAN PABLO", nombre: "MTD", recetaId: "mtd" }];
  const recetas: RecetaCalc[] = [
    {
      id: "mtd",
      nombre: "MTD",
      planta: "SAN PABLO",
      items: [
        { codigo: "MPCM01004", nombre: "Carmín", kgPorBatch: 1 },
        { codigo: "MPCM01182", nombre: "Carmín alias", kgPorBatch: 0.5 },
      ],
      empaque: [],
    },
  ];
  const porFila = new Map<number, BatchesDia>([
    [1, { lunes: 2, martes: 0, miercoles: 0, jueves: 0, viernes: 0 }],
  ]);
  const totales = calcularMpnc(filas, recetas, porFila);
  assert.equal(totales.length, 1);
  assert.equal(totales[0]?.codigo, "MPCM01004");
  assert.equal(totales[0]?.nombre, "Carmín");
  assert.equal(totales[0]?.cantidad, 3);
});

test("el csv de recetas lee coma decimal y rechaza una línea corta", () => {
  const bueno = parseCsvRecetas("receta,codigo,ingrediente,kg_por_batch\npm,MPCM01009,Sal,31,59\n");
  assert.equal(bueno.ok, true);
  if (!bueno.ok) return;
  assert.equal(bueno.filas[0]?.kgPorBatch, 31.59);
  assert.equal(bueno.filas[0]?.codigo, "MPCM01009");
  const malo = parseCsvRecetas("pm,MPCM01009,Sal\n");
  assert.equal(malo.ok, false);
});
