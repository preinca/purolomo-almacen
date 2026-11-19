"use client";

import { useState } from "react";
import { DosificacionForm } from "@/components/dosificacion-form";
import {
  DESTINOS_MAKILAS,
  DESTINOS_RAIZ,
  textoDestino,
  type DestinoDosificacion,
} from "@/lib/destino-dosificacion";

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
          {DESTINOS_MAKILAS.map((item) => (
            <BotonDestino
              key={item.id}
              titulo={item.nombre}
              codigo={item.codigo}
              detalle={item.detalle}
              tono="ambar"
              onClick={() => elegir(item.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (paso === "ficha" && destino) {
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
          <p className="text-lg font-semibold">Destino: {textoDestino(destino)}</p>
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
    <div className="grid gap-4 sm:min-h-72 sm:grid-cols-3">
      {DESTINOS_RAIZ.map((item) => (
        <BotonDestino
          key={item.id}
          titulo={item.nombre}
          codigo={item.codigo}
          detalle={item.detalle}
          onClick={() => elegir(item.id)}
        />
      ))}
      <BotonDestino
        titulo="Makilas"
        detalle="San Pablo, Turmero, P.E.V o Planta SST."
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
  codigo,
  detalle,
  tono = "rojo",
  onClick,
}: {
  titulo: string;
  codigo?: string;
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
      {codigo ? <span className="font-mono text-sm font-semibold text-foreground">{codigo}</span> : null}
      <span className="text-sm leading-relaxed text-muted-foreground">{detalle}</span>
    </button>
  );
}
