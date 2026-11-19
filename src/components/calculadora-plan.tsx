"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { guardarPlanBatches } from "@/app/calculadora-acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DIAS,
  NOMBRE_DIA,
  calcularMpnc,
  sumaBatches,
  type BatchesDia,
  type Dia,
  type FilaPlan,
  type RecetaCalc,
} from "@/lib/calculadora";
import { formatoNumero } from "@/lib/formato";

export function PlanSemanal({
  id,
  semana,
  anio,
  filas,
  recetas,
  puedeEditar,
}: {
  id: number;
  semana: number;
  anio: number;
  filas: (FilaPlan & { batches: BatchesDia })[];
  recetas: RecetaCalc[];
  puedeEditar: boolean;
}) {
  const [valores, setValores] = useState(() => new Map(filas.map((fila) => [fila.orden, { ...fila.batches }])));
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const porFila = useMemo(() => valores, [valores]);
  const totales = useMemo(
    () => calcularMpnc(filas, recetas, porFila).filter((fila) => (fila.cantidad ?? 0) > 0),
    [filas, recetas, porFila],
  );

  function cambiar(orden: number, dia: Dia, texto: string) {
    const numero = texto.trim() === "" ? 0 : Number(texto.replace(",", "."));
    setValores((actual) => {
      const siguiente = new Map(actual);
      const previo = siguiente.get(orden) ?? { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 };
      siguiente.set(orden, { ...previo, [dia]: Number.isFinite(numero) ? numero : 0 });
      return siguiente;
    });
  }

  function guardar() {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = await guardarPlanBatches(
        id,
        filas.map((fila) => ({ orden: fila.orden, batches: valores.get(fila.orden) ?? fila.batches })),
      );
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setAviso("Semana guardada.");
    });
  }

  return (
    <div className="grid gap-6">
      {aviso ? <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">{aviso}</p> : null}
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-950">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {puedeEditar ? (
          <Button type="button" disabled={pendiente} onClick={guardar}>
            {pendiente ? "Guardando…" : "Guardar semana"}
          </Button>
        ) : null}
        <Link href={`/calculadora/${id}/resultado`} className="inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium">
          Ver solicitud
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="sticky left-0 bg-muted/60 px-3 py-2">Producto</th>
              {DIAS.map((dia) => (
                <th key={dia} className="px-2 py-2">{NOMBRE_DIA[dia]}</th>
              ))}
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, indice) => {
              const batches = valores.get(fila.orden) ?? fila.batches;
              const encabezado = filas[indice - 1]?.planta !== fila.planta;
              return (
                <Fragment key={fila.orden}>
                  {encabezado ? (
                    <tr className="bg-navy/5">
                      <td colSpan={7} className="px-3 py-2 text-xs font-semibold tracking-wide uppercase">{fila.planta}</td>
                    </tr>
                  ) : null}
                  <tr className="border-t">
                    <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium">{fila.nombre}</th>
                    {DIAS.map((dia) => (
                      <td key={dia} className="px-2 py-1.5">
                        <Input
                          inputMode="decimal"
                          disabled={!puedeEditar}
                          aria-label={`${fila.nombre} ${NOMBRE_DIA[dia]}`}
                          value={batches[dia] ? String(batches[dia]) : ""}
                          placeholder="0"
                          className="h-11 w-16 px-2 text-base"
                          onChange={(event) => cambiar(fila.orden, dia, event.target.value)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 font-semibold">{formatoNumero(sumaBatches(batches), 2)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <details open className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">Totales MPNC en vivo · semana {semana} de {anio}</summary>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {totales.length === 0 ? <li className="text-muted-foreground">Todavía no hay batches.</li> : null}
          {totales.map((total) => (
            <li key={total.codigo} className="flex justify-between gap-3 border-b py-1">
              <span><span className="font-mono text-xs">{total.codigo}</span> {total.nombre}</span>
              <span className="font-semibold">{formatoNumero(total.cantidad ?? 0, 3)} kg</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
