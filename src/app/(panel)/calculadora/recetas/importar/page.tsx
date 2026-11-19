import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ImportarCsv } from "@/components/calculadora-csv";
import { PageFrame } from "@/components/page-frame";
import { exigirRango } from "@/lib/usuarios";

export default function Page() {
  return (
    <PageFrame
      titulo="Importar recetas"
      descripcion="Cuando llegue el Excel de recetas diarias, expórtalo a CSV con estas columnas: receta, codigo, ingrediente, kg_por_batch. La receta es el id (pm, cdl-alibal, sp-mtd-con-todo…)."
      acciones={<Link href="/calculadora/recetas" className="text-sm underline">Volver</Link>}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Cuerpo />
      </Suspense>
    </PageFrame>
  );
}

async function Cuerpo() {
  await connection();
  await exigirRango(["administrador"]);
  return (
    <div className="grid gap-4">
      <pre className="overflow-x-auto rounded-xl border bg-white p-4 text-xs">{`receta,codigo,ingrediente,kg_por_batch
pm,MPCM01009,Sal con Yodo y Flúor,31.59
cdl-alibal,MPCM01009,Sal con Yodo y Flúor,33.80`}</pre>
      <p className="text-sm text-muted-foreground">
        Si el código ya está en la receta, se actualizan el nombre y los kilos. Si no está, se agrega. El separador puede ser coma o punto y coma, y los kilos aceptan coma decimal.
      </p>
      <ImportarCsv />
    </div>
  );
}
