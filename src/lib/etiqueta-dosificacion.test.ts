import assert from "node:assert/strict";
import test from "node:test";
import { codigoDestino, textoDestino } from "./destino-dosificacion.ts";
import { textoQrDosificacion, zplEtiquetaPaleta } from "./etiqueta-dosificacion.ts";

test("cada destino de dosificación tiene su código", () => {
  assert.equal(textoDestino("produccion"), "Producción · 40602-1");
  assert.equal(textoDestino("cerdo"), "Cerdo · 40602-3");
  assert.equal(textoDestino("makilas_san_pablo"), "Makilas · San Pablo · 60994");
  assert.equal(textoDestino("makilas_induproca"), "Makilas · Induproca · 60993");
  assert.equal(textoDestino("makilas_pev"), "Makilas · P.E.V · 40644");
  assert.equal(textoDestino("makilas_sst"), "Makilas · Planta SST · 60996");
  assert.equal(codigoDestino("makilas_san_pablo"), "60994");
  assert.equal(codigoDestino("makilas_induproca"), "60993");
});

test("el QR de la dosificación lleva el id y no es un token de entrada", () => {
  const texto = textoQrDosificacion({
    id: 15,
    codigo: "MPCM01009",
    descripcion: "SAL CON YODO Y FLUOR",
    nucleo: "N-12",
    pesoUnitario: 2.5,
    cantidad: 4,
    pesoTotal: 10,
    creadoEn: "2026-11-19T18:00:00.000Z",
    destino: "makilas_induproca",
    destinoCodigo: "60993",
  });
  assert.match(texto, /^PUROLOMO DOSIFICACION/);
  assert.match(texto, /ID:15/);
  assert.match(texto, /Codigo:MPCM01009/);
  assert.match(texto, /Kg total:10/);
  assert.match(texto, /Kg unidad:2\.5/);
  assert.match(texto, /Unidades:4/);
  assert.match(texto, /Nucleo:N-12/);
  assert.match(texto, /Destino:Makilas · Induproca · 60993/);
  assert.match(texto, /Destino codigo:60993/);
  assert.equal(texto.startsWith("PLT-"), false);
});

test("la etiqueta de paleta usa el mismo tamaño y el qr a la derecha", () => {
  const zpl = zplEtiquetaPaleta({
    id: 15,
    codigo: "MPCM01009",
    descripcion: "SAL CON YODO Y FLUOR",
    nucleo: "N-12",
    pesoUnitario: 2.5,
    cantidad: 4,
    pesoTotal: 10,
    creadoEn: "2026-11-19T18:00:00.000Z",
    destino: "makilas_induproca",
    destinoCodigo: "60993",
  });
  assert.match(zpl, /\^FDPAL 15\^FS/);
  assert.match(zpl, /MPCM01009/);
  assert.match(zpl, /10 kg/);
  assert.match(zpl, /60993/);
  assert.match(zpl, /\^PW456/);
  assert.match(zpl, /\^LL256/);
  assert.doesNotMatch(zpl, /\^BQ/);
  const cajas = [...zpl.matchAll(/\^FO(\d+),(\d+)\^GB(\d+),(\d+),/g)];
  assert.ok(cajas.length > 0);
  let izquierda = 456;
  let derecha = 0;
  for (const caja of cajas) {
    const x = Number(caja[1]);
    const ancho = Number(caja[3]);
    izquierda = Math.min(izquierda, x);
    derecha = Math.max(derecha, x + ancho);
  }
  assert.ok(izquierda >= 286);
  assert.ok(derecha <= 456);
});
