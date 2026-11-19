import { renderSVG } from "uqr";
import type { DestinoDosificacion } from "./destino-dosificacion";
import { textoDestino } from "./destino-dosificacion";

export type DatosEtiquetaDosificacion = {
  id: number;
  codigo: string;
  descripcion: string;
  nucleo: string;
  pesoUnitario: number;
  cantidad: number;
  pesoTotal: number;
  creadoEn: string;
  destino: DestinoDosificacion | null;
  destinoCodigo: string | null;
};

/** Mismo estilo que el QR de producción: una línea por dato y un ID para buscarla después. */
export function textoQrDosificacion(datos: DatosEtiquetaDosificacion) {
  const destino = textoDestino(datos.destino, datos.destinoCodigo);
  const codigoDestino = (datos.destinoCodigo ?? "").trim();
  return [
    "PUROLOMO DOSIFICACION",
    `ID:${datos.id}`,
    `Fecha:${datos.creadoEn}`,
    `Producto:${datos.descripcion}`,
    `Codigo:${datos.codigo}`,
    `Kg total:${datos.pesoTotal}`,
    `Kg unidad:${datos.pesoUnitario}`,
    `Unidades:${datos.cantidad}`,
    `Nucleo:${datos.nucleo}`,
    `Destino:${destino}`,
    ...(codigoDestino ? [`Destino codigo:${codigoDestino}`] : []),
  ].join("\n");
}

/** Mismos parámetros que el QR en pantalla de una etiqueta de TAG: módulos grandes. */
export function svgQrDosificacion(datos: DatosEtiquetaDosificacion) {
  return renderSVG(textoQrDosificacion(datos), {
    border: 4,
    ecc: "H",
    pixelSize: 8,
    blackColor: "#000000",
    whiteColor: "#ffffff",
  });
}
