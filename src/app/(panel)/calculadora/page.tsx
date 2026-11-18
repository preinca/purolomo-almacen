import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NuevaSemana } from "@/components/calculadora-nueva";
import { PageFrame } from "@/components/page-frame";
import { listarPlanes, planAnterior, prepararCalculadora } from "@/lib/calculadora-db";
import { getDb } from "@/lib/db";
import { fechaHoy } from "@/lib/formato";
import { leerSesion } from "@/lib/usuarios";

export default function Page() {
  return (
    <PageFrame
      titulo="Calculadora semanal"
      descripcion="Batches de lunes a viernes. El total de cada materia prima es la suma de la semana por los kilos de la receta."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Lista />
      </Suspense>
    </PageFrame>
  );
}

async function Lista() {
  await connection();
  const db = getDb();
  await prepararCalculadora(db);
  const sesion = await leerSesion();
  const planes = await listarPlanes(db);
  const anio = Number(fechaHoy().slice(0, 4));
  const puedeEditar = sesion?.rango === "administrador" || sesion?.rango === "recepcionista";
  const anterior = await planAnterior(db, anio + 1, 1);

  return (
    <div className="grid gap-8">
      {puedeEditar ? <NuevaSemana anio={anio} hayAnterior={!!anterior} /> : null}
      {sesion?.rango === "administrador" ? (
        <p className="text-sm">
          <Link href="/calculadora/recetas" className="font-medium underline">Recetas y empaque</Link>
          {" · "}
          <Link href="/calculadora/recetas/importar" className="font-medium underline">Importar CSV</Link>
        </p>
      ) : null}
      <ul className="grid gap-2">
        {planes.length === 0 ? <li className="text-sm text-muted-foreground">Todavía no hay semanas guardadas.</li> : null}
        {planes.map((plan) => (
          <li key={plan.id}>
            <Link href={`/calculadora/${plan.id}`} className="flex min-h-14 items-center justify-between rounded-xl border bg-white px-4 py-3">
              <span className="font-semibold">Semana {plan.semana} · {plan.anio}</span>
              <span className="text-sm text-muted-foreground">{plan.usuario}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
