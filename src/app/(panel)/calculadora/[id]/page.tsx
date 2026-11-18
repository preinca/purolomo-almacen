import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanSemanal } from "@/components/calculadora-plan";
import { PageFrame } from "@/components/page-frame";
import { cargarPlan } from "@/lib/calculadora-db";
import { getDb } from "@/lib/db";
import { leerSesion } from "@/lib/usuarios";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
      <Plan params={params} />
    </Suspense>
  );
}

async function Plan({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const plan = await cargarPlan(getDb(), id);
  if (!plan) notFound();
  const sesion = await leerSesion();
  const puedeEditar = sesion?.rango === "administrador" || sesion?.rango === "recepcionista";

  return (
    <PageFrame
      titulo={`Semana ${plan.semana}`}
      descripcion={`Año ${plan.anio}. Varias presentaciones comparten receta: sus batches se suman.`}
      acciones={<Link href="/calculadora" className="text-sm underline">Todas las semanas</Link>}
    >
      <PlanSemanal
        id={plan.id}
        semana={plan.semana}
        anio={plan.anio}
        filas={plan.filas}
        recetas={plan.recetas}
        puedeEditar={puedeEditar}
      />
    </PageFrame>
  );
}
