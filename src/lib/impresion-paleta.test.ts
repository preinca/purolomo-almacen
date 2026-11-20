import assert from "node:assert/strict";
import test from "node:test";
import { basePrueba } from "./db-prueba.ts";
import { encolarZpl, tomarImpresion } from "./impresion.ts";

test("un zpl de paleta sale de la cola sin buscar un tag", async () => {
  const db = await basePrueba();
  const zpl = "^XA^PW456^LL256^FD PAL 15^FS^XZ";
  const encolado = await encolarZpl(db, zpl);
  assert.equal(encolado.ok, true);
  const trabajo = await tomarImpresion(db);
  assert.equal(trabajo?.zpl, zpl);
  assert.equal(await tomarImpresion(db), null);
});
