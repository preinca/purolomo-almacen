"use client";

import { useState, useTransition } from "react";
import { guardarCantidadSolicitada } from "@/app/calculadora-acciones";
import { Input } from "@/components/ui/input";
import type { FilaResultado } from "@/lib/calculadora-db";
import { formatoNumero } from "@/lib/formato";

export function TablaSolicitud({
  planId,
  filas,
  puedeEditar,
}: {
  planId: number;
  filas: FilaResultado[];
  puedeEditar: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Descripción</th>
            <th className="px-3 py-2">Calculado</th>
            <th className="px-3 py-2">Cant. solicitada</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <Fila key={`${fila.tipo}-${fila.codigo}`} planId={planId} fila={fila} puedeEditar={puedeEditar} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fila({ planId, fila, puedeEditar }: { planId: number; fila: FilaResultado; puedeEditar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(fila.solicitada === null ? "" : String(fila.solicitada));
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const plantas = Object.entries(fila.porPlanta).filter(([, kg]) => kg > 0);
  const mostrado = texto.trim() === "" ? fila.cantidad : Number(texto.replace(",", "."));

  function guardar() {
    if (!puedeEditar) return;
    setAviso(null);
    iniciar(async () => {
      const resultado = await guardarCantidadSolicitada(planId, fila.codigo, fila.tipo, texto);
      setAviso(resultado.ok ? "Guardado" : resultado.error);
    });
  }

  return (
    <>
      <tr className="border-t">
        <td className="px-3 py-2 font-mono text-xs">{fila.codigo}</td>
        <td className="px-3 py-2">
          <button type="button" className="text-left" onClick={() => setAbierto((v) => !v)}>
            {fila.nombre}
          </button>
        </td>
        <td className="px-3 py-2">{fila.cantidad === null ? "—" : `${formatoNumero(fila.cantidad, 3)} ${fila.unidad}`}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Input
              inputMode="decimal"
              disabled={!puedeEditar || pendiente}
              aria-label={`Cantidad solicitada de ${fila.nombre}`}
              value={texto}
              placeholder={fila.cantidad === null ? "" : String(fila.cantidad)}
              className="h-11 w-28"
              onChange={(event) => setTexto(event.target.value)}
              onBlur={guardar}
            />
            <span className="text-xs text-muted-foreground">{fila.unidad}</span>
          </div>
          {aviso ? <span className="text-xs text-muted-foreground">{aviso}</span> : null}
        </td>
      </tr>
      {abierto && plantas.length > 0 ? (
        <tr className="bg-muted/30">
          <td colSpan={4} className="px-3 py-2 text-xs">
            {plantas.map(([planta, kg]) => (
              <span key={planta} className="mr-4">{planta}: {formatoNumero(kg, 3)}</span>
            ))}
            {Number.isFinite(mostrado) ? null : <span>La cantidad solicitada no es un número.</span>}
          </td>
        </tr>
      ) : null}
    </>
  );
}
