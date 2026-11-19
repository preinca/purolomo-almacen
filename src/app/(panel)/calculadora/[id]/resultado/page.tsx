import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TablaSolicitud } from "@/components/calculadora-resultado";
import { PageFrame } from "@/components/page-frame";
import { resultadoPlan } from "@/lib/calculadora-db";
import { getDb } from "@/lib/db";
import { leerSesion } from "@/lib/usuarios";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
      <Resultado params={params} />
    </Suspense>
  );
}

async function Resultado({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const datos = await resultadoPlan(getDb(), id);
  if (!datos) notFound();
  const sesion = await leerSesion();
  const puedeEditar = sesion?.rango === "administrador" || sesion?.rango === "recepcionista";

  return (
    <PageFrame
      titulo={`Solicitud semana ${datos.plan.semana}`}
      descripcion="Toca el nombre para ver el detalle por planta. La cantidad solicitada arranca igual al cálculo; cámbiala si redondeas a sacos."
      acciones={
        <>
          <Link href={`/calculadora/${id}`} className="text-sm underline">Volver al plan</Link>
          <Link href={`/calculadora/${id}/imprimir`} className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
            Imprimir
          </Link>
        </>
      }
    >
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">MPNC</h2>
        <TablaSolicitud planId={id} filas={datos.mpnc} puedeEditar={puedeEditar} />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Empaque</h2>
        <p className="text-sm text-muted-foreground">
          La cantidad por batch empieza vacía. Hasta que la completes en la receta, el cálculo queda en blanco y la solicitada se escribe a mano.
        </p>
        <TablaSolicitud planId={id} filas={datos.empaque} puedeEditar={puedeEditar} />
      </section>
    </PageFrame>
  );
}
