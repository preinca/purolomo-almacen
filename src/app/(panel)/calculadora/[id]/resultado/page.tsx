import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { cargarPlan } from "@/lib/calculadora-db";
import { getDb } from "@/lib/db";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
      <Destino params={params} />
    </Suspense>
  );
}

async function Destino({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const plan = await cargarPlan(getDb(), id);
  if (!plan) notFound();
  if (plan.cerrado) redirect(`/calculadora/${id}/imprimir`);
  redirect(`/calculadora/${id}`);
}
