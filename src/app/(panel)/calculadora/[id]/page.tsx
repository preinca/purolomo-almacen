import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SolicitudMpnc } from "@/components/calculadora-plan";
import { PageFrame } from "@/components/page-frame";
import { cargarPlan } from "@/lib/calculadora-db";
import { getDb } from "@/lib/db";
import { leerSesion } from "@/lib/usuarios";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
      <Plan params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Plan({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string | string[] }>;
}) {
  await connection();
  const [{ id: idTexto }, consulta] = await Promise.all([params, searchParams]);
  const id = Number(idTexto);
  const paso = consulta.paso === "empaque" ? "empaque" : "mpnc";
  const plan = await cargarPlan(getDb(), id);
  if (!plan) notFound();
  if (plan.cerrado) redirect(`/calculadora/${id}/imprimir`);
  const sesion = await leerSesion();
  const puedeEditar = sesion?.rango === "administrador" || sesion?.rango === "recepcionista";

  return (
    <PageFrame
      titulo={`Semana ${plan.semana}`}
      descripcion="Primero los batches de materia prima. Después el material de empaque."
      acciones={<Link href="/calculadora" className="text-sm underline">Solicitudes</Link>}
    >
      <SolicitudMpnc
        key={plan.id}
        id={plan.id}
        semana={plan.semana}
        anio={plan.anio}
        filas={plan.filas}
        recetas={plan.recetas}
        puedeEditar={puedeEditar}
        pasoInicial={paso}
      />
    </PageFrame>
  );
}
