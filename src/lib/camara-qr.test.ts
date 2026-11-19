import assert from "node:assert/strict";
import test from "node:test";
import { elegirCamaraPrincipal, esGranAngular, objetivoZoom } from "./camara-qr.ts";

test("la ultra gran angular no se confunde con la trasera principal", () => {
  assert.equal(esGranAngular("Back Ultra Wide Camera"), true);
  assert.equal(esGranAngular("Cámara ultra gran angular trasera"), true);
  assert.equal(esGranAngular("Back Dual Wide Camera"), true);
  assert.equal(esGranAngular("Wide Angle Camera"), true);
  assert.equal(esGranAngular("Back Camera"), false);
  assert.equal(esGranAngular("Cámara trasera"), false);
});

test("elige Back Camera o Cámara trasera antes que la 0.5 y el tele", () => {
  const ingles = elegirCamaraPrincipal([
    { deviceId: "ultra", label: "Back Ultra Wide Camera" },
    { deviceId: "tele", label: "Back Telephoto Camera" },
    { deviceId: "main", label: "Back Camera" },
    { deviceId: "front", label: "Front Camera" },
  ]);
  assert.equal(ingles, "main");

  const espanol = elegirCamaraPrincipal([
    { deviceId: "ultra", label: "Cámara ultra gran angular trasera" },
    { deviceId: "main", label: "Cámara trasera" },
  ]);
  assert.equal(espanol, "main");
});

test("la cámara guardada gana aunque sea la ultra gran angular", () => {
  const id = elegirCamaraPrincipal(
    [
      { deviceId: "ultra", label: "Back Ultra Wide Camera" },
      { deviceId: "main", label: "Back Camera" },
    ],
    "ultra",
  );
  assert.equal(id, "ultra");
});

test("un id guardado que ya no existe vuelve a la trasera principal", () => {
  const id = elegirCamaraPrincipal(
    [
      { deviceId: "ultra", label: "Back Dual Wide Camera" },
      { deviceId: "main", label: "Back Camera" },
    ],
    "vieja",
  );
  assert.equal(id, "main");
});

test("sin etiquetas no adivina la cámara", () => {
  assert.equal(elegirCamaraPrincipal([{ deviceId: "a", label: "" }]), undefined);
});

test("el zoom de la 0.5 sube a 1x", () => {
  assert.equal(objetivoZoom(0.5, 5), 1);
  assert.equal(objetivoZoom(1, 4), 2);
  assert.equal(objetivoZoom(1, 1.5), 1);
});
