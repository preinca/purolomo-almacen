"use client";

import { useState } from "react";
import { DosificacionForm } from "@/components/dosificacion-form";
import { etiquetaDestino, type DestinoDosificacion } from "@/lib/destino-dosificacion";

type Paso = "empresa" | "planta" | "ficha";

export function DosificacionConDestino() {
  const [paso, setPaso] = useState<Paso>("empresa");
  const [destino, setDestino] = useState<DestinoDosificacion | null>(null);

  if (paso === "planta") {
    return (
      <div className="grid gap-4">
        <button type="button" onClick={() => setPaso("empresa")} className="h-11 justify-self-start rounded-lg border px-4 text-sm">
          Volver
        </button>
        <div className="grid gap-4 sm:min-h-72 sm:grid-cols-2">
          <BotonDestino
            titulo="San Pablo"
            detalle="Dosificar para Makilas en San Pablo."
            onClick={() => elegir("makilas_san_pablo")}
          />
          <BotonDestino
            titulo="Turmero"
            detalle="Dosificar para Makilas en Turmero."
            onClick={() => elegir("makilas_turmero")}
          />
        </div>
      </div>
    );
  }

  if (paso === "ficha" && destino) {
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
          <p className="text-lg font-semibold">Destino: {etiquetaDestino(destino)}</p>
          <button
            type="button"
            onClick={() => {
              setDestino(null);
              setPaso("empresa");
            }}
            className="h-11 rounded-lg border px-4 text-sm"
          >
            Cambiar destino
          </button>
        </div>
        <DosificacionForm destino={destino} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:min-h-72 sm:grid-cols-2">
      <BotonDestino
        titulo="Purolomo"
        detalle="Abre la dosificación para Purolomo."
        onClick={() => elegir("purolomo")}
      />
      <BotonDestino
        titulo="Makilas"
        detalle="Después eliges San Pablo o Turmero."
        tono="ambar"
        onClick={() => setPaso("planta")}
      />
    </div>
  );

  function elegir(valor: DestinoDosificacion) {
    setDestino(valor);
    setPaso("ficha");
  }
}

function BotonDestino({
  titulo,
  detalle,
  tono = "rojo",
  onClick,
}: {
  titulo: string;
  detalle: string;
  tono?: "rojo" | "ambar";
  onClick: () => void;
}) {
  const hover = tono === "ambar" ? "hover:border-orange-500" : "hover:border-purolomo-red";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid content-center gap-2 rounded-2xl border border-border bg-white px-6 py-10 text-left text-foreground sm:py-14 ${hover}`}
    >
      <span className="text-xl font-semibold">{titulo}</span>
      <span className="text-sm leading-relaxed text-muted-foreground">{detalle}</span>
    </button>
  );
}
