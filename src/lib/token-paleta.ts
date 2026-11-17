import { fechaValida } from "./formato";
import type { Resultado } from "./lotes";

/** PLT-codigo-lote-secuencia-id, como PLT-MPCM01009-1009111126-6-59651802. */
const TOKEN = /^PLT-([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)$/;

export type PartesToken = {
  token: string;
  codigo: string;
  lote: string;
  secuencia: string;
  id: string;
};

export type DatosPaleta = {
  token: string;
  codigo: string;
  producto: string;
  kg: number;
  lote: string;
  vencimiento: string;
};

export function partirToken(texto: string): Resultado<PartesToken> {
  const token = texto.trim().toUpperCase().replace(/\s+/g, "");
  const match = TOKEN.exec(token);
  if (!match) return { ok: false, error: "Ese QR no tiene el token de una paleta." };
  return {
    ok: true,
    value: {
      token,
      codigo: match[1],
      lote: match[2],
      secuencia: match[3],
      id: match[4],
    },
  };
}

/** El código y el lote que devuelve el otro dashboard tienen que ser los del token. */
export function cruzarConToken(partes: PartesToken, paleta: DatosPaleta): Resultado<DatosPaleta> {
  const codigo = paleta.codigo.trim().toUpperCase();
  const lote = paleta.lote.trim().toUpperCase();
  const token = paleta.token.trim().toUpperCase();
  const producto = paleta.producto.trim();
  const vencimiento = paleta.vencimiento.trim();
  const kg = Math.round(Number(paleta.kg) * 1000) / 1000;

  if (token !== partes.token) {
    return { ok: false, error: "El token que devolvió el otro dashboard no es el que se escaneó." };
  }
  if (codigo !== partes.codigo) {
    return { ok: false, error: "El código que devolvió el otro dashboard no coincide con el token." };
  }
  if (lote !== partes.lote) {
    return { ok: false, error: "El lote que devolvió el otro dashboard no coincide con el token." };
  }
  if (!producto) return { ok: false, error: "El otro dashboard no envió el nombre del producto." };
  if (!Number.isFinite(kg) || kg <= 0) {
    return { ok: false, error: "El otro dashboard no envió los kilos de la paleta." };
  }
  if (!fechaValida(vencimiento)) {
    return { ok: false, error: "El otro dashboard no envió una fecha de vencimiento válida." };
  }

  return {
    ok: true,
    value: { token: partes.token, codigo, producto, kg, lote, vencimiento },
  };
}
