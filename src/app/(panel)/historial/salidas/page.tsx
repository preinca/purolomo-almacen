import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { formatoFecha, formatoKg } from "@/lib/formato";
import { lineaPorId } from "@/lib/lineas";
import { LIMITE_HISTORIAL_SALIDAS, listarHistorialSalidas } from "@/lib/lotes";

export default function Page() {
  return (
    <PageFrame
      titulo="Historial de salidas"
      descripcion={`Consumos y despachos por TAG, del más reciente al más antiguo. Se listan hasta ${LIMITE_HISTORIAL_SALIDAS}. Los traslados a logística no entran aquí.`}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando historial…</p>}>
        <Historial />
      </Suspense>
    </PageFrame>
  );
}

async function Historial() {
  await connection();
  const filas = await listarHistorialSalidas(getDb());

  return (
    <Card>
      <CardContent className="pt-4">
        {filas.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay salidas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>TAG</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Línea</TableHead>
                <TableHead className="text-right">Kg</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>{formatoFecha(mov.fecha)}</TableCell>
                  <TableCell className="capitalize">{mov.tipo}</TableCell>
                  <TableCell className="font-mono">
                    <Link href={`/lote/${mov.tag}`} className="hover:underline">
                      {mov.tag}
                    </Link>
                  </TableCell>
                  <TableCell>{mov.destino || "—"}</TableCell>
                  <TableCell>{lineaPorId(mov.linea)?.nombre ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatoKg(mov.kg)}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {mov.nota || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
