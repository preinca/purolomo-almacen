import { connection } from "next/server";
import { Suspense } from "react";
import { GaleriaEtiquetas } from "@/components/galeria-etiquetas";
import { PageFrame } from "@/components/page-frame";
import { getDb } from "@/lib/db";
import { listarDosificaciones } from "@/lib/dosificacion";

const LIMITE_ETIQUETAS = 500;

export default function Page() {
  return (
    <PageFrame
      titulo="Etiquetas Paletas"
      descripcion="Etiquetas QR de las dosificaciones, de la más reciente a la más antigua, agrupadas por día."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando etiquetas…</p>}>
        <Listado />
      </Suspense>
    </PageFrame>
  );
}

async function Listado() {
  await connection();
  const filas = await listarDosificaciones(getDb(), LIMITE_ETIQUETAS);
  return <GaleriaEtiquetas etiquetas={filas} />;
}
