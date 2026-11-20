"use client";

import { useState } from "react";
import { DosificacionForm } from "@/components/dosificacion-form";
import { DESTINOS_MAKILAS, DESTINOS_RAIZ, type DestinoDosificacion } from "@/lib/destino-dosificacion";

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
      <DosificacionForm
        destino={destino}
        onVolverInicio={() => {
          setDestino(null);
          setPaso("empresa");
        }}
      />
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
        titulo="Maquilas"
        detalle="San Pablo, Induproca, P.E.V o Planta SST."
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
      className={`grid min-h-28 min-w-0 content-center gap-2 rounded-2xl border border-border bg-white px-4 py-8 text-left text-foreground sm:px-6 sm:py-14 ${hover}`}
    >
      <span className="text-xl font-semibold break-words">{titulo}</span>
      {codigo ? <span className="font-mono text-sm font-semibold text-foreground">{codigo}</span> : null}
      <span className="text-sm leading-relaxed text-muted-foreground">{detalle}</span>
    </button>
  );
}
