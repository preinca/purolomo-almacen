import { connection } from "next/server";
import { Suspense } from "react";
import { TablaEntradas } from "@/components/tabla-entradas";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { listarEntradas, resumirEntradas } from "@/lib/entrada-paleta";
import { formatoNumero } from "@/lib/formato";

export default function Page() {
  return (
    <PageFrame
      titulo="Panel de administración"
      descripcion="Entradas de paletas por QR. Cada token guarda el producto, los kilos, el lote y el vencimiento que devolvió el otro dashboard."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando panel…</p>}>
        <Dashboard />
      </Suspense>
    </PageFrame>
  );
}

async function Dashboard() {
  await connection();
  const db = getDb();
  const [resumen, entradas] = await Promise.all([resumirEntradas(db), listarEntradas(db, 12)]);

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Resumen">
        <Kpi
          titulo="Paletas"
          valor={formatoNumero(resumen.paletas)}
          detalle="Entradas registradas"
          color="border-purolomo-red"
        />
        <Kpi
          titulo="Kg recibidos"
          valor={formatoNumero(resumen.kg, 0)}
          detalle="Suma de las paletas"
          color="border-rose-500"
        />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Últimas entradas</CardTitle>
        </CardHeader>
        <CardContent>
          <TablaEntradas entradas={entradas} />
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  detalle,
  color,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  color: string;
}) {
  return (
    <Card size="sm" className={`border-l-4 ${color}`}>
      <CardContent>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{valor}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </CardContent>
    </Card>
  );
}
