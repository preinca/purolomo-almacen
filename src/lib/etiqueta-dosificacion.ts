import { renderSVG } from "uqr";
import type { DestinoDosificacion } from "./destino-dosificacion";
import { textoDestino } from "./destino-dosificacion";
import { fechaCorta, horaRecepcion, lineasDescripcion } from "./etiqueta-cava";
import { formatoKg, ZONA_HORARIA } from "./formato";
import { zplDeLineas } from "./zpl-etiqueta";

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

export function datosEtiqueta(fila: DatosEtiquetaDosificacion): DatosEtiquetaDosificacion {
  return {
    id: fila.id,
    codigo: fila.codigo,
    descripcion: fila.descripcion,
    nucleo: fila.nucleo,
    pesoUnitario: fila.pesoUnitario,
    cantidad: fila.cantidad,
    pesoTotal: fila.pesoTotal,
    creadoEn: fila.creadoEn,
    destino: fila.destino,
    destinoCodigo: fila.destinoCodigo,
  };
}

/** Líneas cortas, como la etiqueta de cava: título, producto, código, kilos, destino, fecha y hora. */
export function lineasEtiquetaPaleta(datos: DatosEtiquetaDosificacion) {
  const destino = textoDestino(datos.destino, datos.destinoCodigo);
  return [
    datos.nucleo.trim(),
    ...lineasDescripcion(datos.descripcion, 14),
    datos.codigo,
    formatoKg(datos.pesoTotal),
    ...(destino === "—" ? [] : lineasDescripcion(destino, 16)),
    fechaDeCaracas(datos.creadoEn),
    horaRecepcion(datos.creadoEn),
  ].filter((linea) => linea.trim().length > 0);
}

/** El QR impreso va corto, como el de cava, para que los módulos quepan a la derecha y el celular lo lea. */
export function textoQrImpresoPaleta(datos: DatosEtiquetaDosificacion) {
  return `PUROLOMO DOSIFICACION\nID:${datos.id}`;
}

/** ZPL de 5,7 cm × 3,2 cm. El texto queda a la izquierda y el QR corto, dibujado a la derecha. */
export function zplEtiquetaPaleta(datos: DatosEtiquetaDosificacion) {
  return zplDeLineas(lineasEtiquetaPaleta(datos), textoQrImpresoPaleta(datos));
}

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

function fechaDeCaracas(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return fechaCorta(dia);
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
