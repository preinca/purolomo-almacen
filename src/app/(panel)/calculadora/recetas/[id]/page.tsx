import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditorReceta } from "@/components/calculadora-receta";
import { PageFrame } from "@/components/page-frame";
import { cargarRecetaAdmin } from "@/lib/calculadora-db";
import { getDb } from "@/lib/db";
import { exigirRango } from "@/lib/usuarios";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
      <Receta params={params} />
    </Suspense>
  );
}

async function Receta({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await exigirRango(["administrador"]);
  const receta = await cargarRecetaAdmin(getDb(), (await params).id);
  if (!receta) notFound();
  return (
    <PageFrame
      titulo={receta.nombre}
      descripcion={receta.planta}
      acciones={<Link href="/calculadora/recetas" className="text-sm underline">Todas las recetas</Link>}
    >
      <EditorReceta recetaId={receta.id} items={receta.items} />
    </PageFrame>
  );
}
