import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AnularDosificacion } from "@/components/dosificacion-form";
import { PageFrame } from "@/components/page-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { textoDestino } from "@/lib/destino-dosificacion";
import { listarDosificaciones } from "@/lib/dosificacion";
import { ZONA_HORARIA, formatoFecha, formatoHora, formatoKg } from "@/lib/formato";
import { lineaPorId } from "@/lib/lineas";
import { LIMITE_HISTORIAL_SALIDAS, listarHistorialSalidas } from "@/lib/lotes";
import { leerSesion } from "@/lib/usuarios";

function diaEnCaracas(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function Page() {
  return (
    <PageFrame
      titulo="Historial de Dosificaciones"
      descripcion={`Dosificaciones de paleta y salidas de TAG, de la más reciente a la más antigua. Se listan hasta ${LIMITE_HISTORIAL_SALIDAS} de cada lista. El consumo de una dosificación no se repite abajo. Un traslado a logística no entra.`}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando historial…</p>}>
        <Historial />
      </Suspense>
    </PageFrame>
  );
}

async function Historial() {
  await connection();
  const db = getDb();
  const [dosificaciones, movimientos, sesion] = await Promise.all([
    listarDosificaciones(db, LIMITE_HISTORIAL_SALIDAS),
    listarHistorialSalidas(db),
    leerSesion(),
  ]);
  const puedeAnular = sesion?.rango === "administrador" || sesion?.rango === "pesador";

  if (dosificaciones.length === 0 && movimientos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay dosificaciones.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-8">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Dosificaciones</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {dosificaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay dosificaciones.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Núcleo</TableHead>
                  <TableHead className="text-right">Peso unitario</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Peso total</TableHead>
                  <TableHead>Anulada</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dosificaciones.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell>
                      {formatoFecha(diaEnCaracas(fila.creadoEn))}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatoHora(fila.creadoEn) || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {textoDestino(fila.destino, fila.destinoCodigo)}
                    </TableCell>
                    <TableCell className="max-w-40 font-mono text-xs break-all whitespace-normal">{fila.token}</TableCell>
                    <TableCell className="font-mono text-xs">{fila.codigo}</TableCell>
                    <TableCell className="whitespace-normal">{fila.descripcion}</TableCell>
                    <TableCell>{fila.nucleo}</TableCell>
                    <TableCell className="text-right">{formatoKg(fila.pesoUnitario)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fila.cantidad}</TableCell>
                    <TableCell className="text-right font-semibold">{formatoKg(fila.pesoTotal)}</TableCell>
                    <TableCell>{fila.anulada ? "Anulada" : "No"}</TableCell>
                    <TableCell>
                      <Link href={`/historial/salidas/${fila.id}`} className="text-sm underline">
                        Etiqueta
                      </Link>
                      {puedeAnular && !fila.anulada ? (
                        <span className="mt-1 block">
                          <AnularDosificacion id={fila.id} />
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Otras salidas</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay despachos ni consumos de TAG fuera de una dosificación.</p>
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
                {movimientos.map((mov) => (
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
                    <TableCell className="whitespace-normal text-muted-foreground">{mov.nota || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
