import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BotonImprimir } from "@/components/boton-imprimir";
import { resultadoPlan } from "@/lib/calculadora-db";
import { getDb } from "@/lib/db";
import { fechaHoy, formatoNumero } from "@/lib/formato";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Cargando…</p>}>
      <Hoja params={params} />
    </Suspense>
  );
}

async function Hoja({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const datos = await resultadoPlan(getDb(), id);
  if (!datos) notFound();
  const plantas = ["PE PUROLOMO/CDL", "INDUPROCA", "SAN PABLO"];

  return (
    <article className="hoja-solicitud mx-auto max-w-3xl bg-white px-4 py-6 text-black">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/calculadora/${id}/resultado`} className="text-sm underline">Volver</Link>
        <BotonImprimir etiqueta="Imprimir" />
      </div>
      <header className="mb-4">
        <h1 className="text-xl font-bold">SOLICITUD MPNC – SEMANA {datos.plan.semana}</h1>
        <p className="text-sm">Fecha: {fechaHoy()} · Año {datos.plan.anio}</p>
        <p className="text-sm">Plantas: {plantas.join(" · ")}</p>
      </header>
      <table className="w-full border-collapse text-sm [&_td]:border [&_td]:border-black [&_td]:px-1.5 [&_td]:py-1 [&_th]:border [&_th]:border-black [&_th]:px-1.5 [&_th]:py-1">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th className="num">Kg calculados</th>
            <th className="num">Cant. solicitada (kg)</th>
          </tr>
        </thead>
        <tbody>
          {datos.mpnc.map((fila) => (
            <tr key={fila.codigo}>
              <td>{fila.codigo}</td>
              <td>{fila.nombre}</td>
              <td className="num">{formatoNumero(fila.cantidad ?? 0, 3)}</td>
              <td className="num">{fila.solicitada === null ? formatoNumero(fila.cantidad ?? 0, 3) : formatoNumero(fila.solicitada, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-6 mb-2 text-base font-bold">Material de empaque</h2>
      <table className="w-full border-collapse text-sm [&_td]:border [&_td]:border-black [&_td]:px-1.5 [&_td]:py-1 [&_th]:border [&_th]:border-black [&_th]:px-1.5 [&_th]:py-1">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th>Unidad</th>
            <th className="num">Calculado</th>
            <th className="num">Cant. solicitada</th>
          </tr>
        </thead>
        <tbody>
          {datos.empaque.map((fila) => (
            <tr key={fila.codigo}>
              <td>{fila.codigo}</td>
              <td>{fila.nombre}</td>
              <td>{fila.unidad}</td>
              <td className="num">{fila.cantidad === null ? "" : formatoNumero(fila.cantidad, 3)}</td>
              <td className="num">{fila.solicitada === null ? (fila.cantidad === null ? "" : formatoNumero(fila.cantidad, 3)) : formatoNumero(fila.solicitada, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="mt-8 grid gap-6 text-sm">
        <p>Observaciones:</p>
        <p className="border-b border-black pb-8" />
        <div className="grid gap-8 sm:grid-cols-2">
          <p>Entregado por: ______________________</p>
          <p>Recibido por: ______________________</p>
        </div>
      </section>
    </article>
  );
}
