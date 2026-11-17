import fs from "node:fs";
import path from "node:path";
import type { Resultado } from "./lotes";
import type { DatosPaleta } from "./token-paleta";

export type OrigenRemoto = { archivo: string };

export type PaletaRemota = DatosPaleta & { recibidaEn: string };

type ArchivoRemoto = {
  responde: boolean;
  paletas: PaletaRemota[];
};

/** La paleta de la foto de prueba. El otro dashboard, en local, la conoce desde el primer arranque. */
export const PALETA_DE_PRUEBA: PaletaRemota = {
  token: "PLT-MPCM01009-1009111126-6-59651802",
  codigo: "MPCM01009",
  producto: "SAL CON YODO Y FLUOR",
  kg: 1000,
  lote: "1009111126",
  vencimiento: "2030-12-07",
  recibidaEn: "",
};

export function origenLocal(): OrigenRemoto {
  return { archivo: path.join(process.cwd(), "data", "dashboard-remoto.json") };
}

export function guardarDashboard(archivo: ArchivoRemoto, origen: OrigenRemoto) {
  fs.mkdirSync(path.dirname(origen.archivo), { recursive: true });
  fs.writeFileSync(origen.archivo, JSON.stringify(archivo, null, 2));
}

function leer(origen: OrigenRemoto): Resultado<ArchivoRemoto> {
  try {
    if (!fs.existsSync(origen.archivo)) {
      const inicial: ArchivoRemoto = { responde: true, paletas: [{ ...PALETA_DE_PRUEBA }] };
      guardarDashboard(inicial, origen);
      return { ok: true, value: inicial };
    }
    const datos = JSON.parse(fs.readFileSync(origen.archivo, "utf8")) as ArchivoRemoto;
    if (!Array.isArray(datos.paletas)) return { ok: false, error: "El otro dashboard no responde. No se registró la entrada." };
    return { ok: true, value: { responde: datos.responde !== false, paletas: datos.paletas } };
  } catch {
    return { ok: false, error: "El otro dashboard no responde. No se registró la entrada." };
  }
}

export async function consultarPaleta(token: string, origen: OrigenRemoto = origenLocal()): Promise<Resultado<DatosPaleta>> {
  const archivo = leer(origen);
  if (!archivo.ok) return archivo;
  if (!archivo.value.responde) {
    return { ok: false, error: "El otro dashboard no responde. No se registró la entrada." };
  }
  const paleta = archivo.value.paletas.find((item) => item.token.toUpperCase() === token.toUpperCase());
  if (!paleta) return { ok: false, error: "El otro dashboard no tiene esta paleta." };
  return {
    ok: true,
    value: {
      token: paleta.token,
      codigo: paleta.codigo,
      producto: paleta.producto,
      kg: paleta.kg,
      lote: paleta.lote,
      vencimiento: paleta.vencimiento,
    },
  };
}

export async function marcarRecibida(
  token: string,
  fecha: string,
  origen: OrigenRemoto = origenLocal(),
): Promise<Resultado> {
  const archivo = leer(origen);
  if (!archivo.ok) return archivo;
  if (!archivo.value.responde) {
    return { ok: false, error: "El otro dashboard no responde. No se registró la entrada." };
  }
  const paleta = archivo.value.paletas.find((item) => item.token.toUpperCase() === token.toUpperCase());
  if (!paleta) return { ok: false, error: "El otro dashboard no tiene esta paleta." };
  paleta.recibidaEn = fecha;
  guardarDashboard(archivo.value, origen);
  return { ok: true, value: undefined };
}

export async function liberarRecibida(token: string, origen: OrigenRemoto = origenLocal()) {
  const archivo = leer(origen);
  if (!archivo.ok || !archivo.value.responde) return;
  const paleta = archivo.value.paletas.find((item) => item.token.toUpperCase() === token.toUpperCase());
  if (!paleta) return;
  paleta.recibidaEn = "";
  guardarDashboard(archivo.value, origen);
}
