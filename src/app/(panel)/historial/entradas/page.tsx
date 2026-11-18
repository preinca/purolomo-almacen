import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { TablaEntradas } from "@/components/tabla-entradas";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { LIMITE_HISTORIAL_ENTRADAS, listarHistorialEntradas } from "@/lib/entrada-paleta";

export default function Page() {
  return (
    <PageFrame
      titulo="Historial de entradas"
      descripcion={`Paletas registradas por QR, de la más reciente a la más antigua. Se listan hasta ${LIMITE_HISTORIAL_ENTRADAS}.`}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando historial…</p>}>
        <Historial />
      </Suspense>
    </PageFrame>
  );
}

async function Historial() {
  await connection();
  const entradas = await listarHistorialEntradas(getDb());
  return (
    <Card>
      <CardContent className="pt-4">
        <TablaEntradas entradas={entradas} mostrarHora mostrarUsuario />
      </CardContent>
    </Card>
  );
}
