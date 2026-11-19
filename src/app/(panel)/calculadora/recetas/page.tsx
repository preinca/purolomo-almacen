import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { listarRecetasAdmin } from "@/lib/calculadora-db";
import { getDb } from "@/lib/db";
import { exigirRango } from "@/lib/usuarios";

export default function Page() {
  return (
    <PageFrame titulo="Recetas de la calculadora" descripcion="Kilos por batch de MPNC y cantidad de empaque por batch. El empaque empieza vacío.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Lista />
      </Suspense>
    </PageFrame>
  );
}

async function Lista() {
  await connection();
  await exigirRango(["administrador"]);
  const recetas = await listarRecetasAdmin(getDb());
  return (
    <ul className="grid gap-2">
      {recetas.map((receta) => (
        <li key={receta.id}>
          <Link href={`/calculadora/recetas/${receta.id}`} className="flex min-h-14 flex-col justify-center rounded-xl border bg-white px-4 py-3">
            <span className="font-semibold">{receta.nombre}</span>
            <span className="text-sm text-muted-foreground">{receta.planta}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
