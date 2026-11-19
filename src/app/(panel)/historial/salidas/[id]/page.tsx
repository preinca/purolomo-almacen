import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EtiquetaDosificacion } from "@/components/etiqueta-dosificacion";
import { getDb } from "@/lib/db";
import { buscarDosificacion } from "@/lib/dosificacion";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Cargando etiqueta…</p>}>
      <Hoja params={params} />
    </Suspense>
  );
}

async function Hoja({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const datos = await buscarDosificacion(getDb(), id);
  if (!datos) notFound();
  return (
    <div className="bg-white p-4">
      <EtiquetaDosificacion datos={datos} />
    </div>
  );
}
