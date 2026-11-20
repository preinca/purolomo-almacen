"use client";

import { useState } from "react";
import { imprimirEtiquetaPaleta } from "@/app/dosificacion-acciones";
import { zplEtiquetaPaleta, type DatosEtiquetaDosificacion } from "@/lib/etiqueta-dosificacion";

export function AccionesEtiquetaPaleta({
  datos,
  guardar = false,
}: {
  datos: DatosEtiquetaDosificacion;
  guardar?: boolean;
}) {
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function imprimir() {
    setOcupado(true);
    setMensaje("");
    setError("");
    const resultado = await imprimirEtiquetaPaleta(datos.id);
    setOcupado(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setMensaje("Enviada a la impresora Zebra.");
  }

  function guardarArchivo() {
    const archivo = new Blob([zplEtiquetaPaleta(datos)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `paleta-${datos.id}.zpl`;
    enlace.click();
    URL.revokeObjectURL(url);
    setError("");
    setMensaje("Etiqueta guardada. No se envió a la impresora.");
  }

  return (
    <div className="grid w-full gap-2 print:hidden">
      <button
        type="button"
        disabled={ocupado}
        onClick={imprimir}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-700 px-4 text-center text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {ocupado ? "Enviando…" : "Imprimir en Zebra"}
      </button>
      {guardar ? (
        <button
          type="button"
          onClick={guardarArchivo}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-white px-4 text-center text-base font-semibold hover:bg-muted"
        >
          Guardar etiqueta
        </button>
      ) : null}
      {mensaje ? <p className="text-center text-sm text-emerald-800">{mensaje}</p> : null}
      {error ? <p className="text-center text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
