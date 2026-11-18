import { connection } from "next/server";
import { Suspense } from "react";
import { EntradaPorQr } from "@/components/entrada-por-qr";
import { PageFrame } from "@/components/page-frame";
import { TablaEntradas } from "@/components/tabla-entradas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { listarEntradas } from "@/lib/entrada-paleta";
import { leerReporteKardex } from "@/lib/reporte-kardex";
import { leerSesion } from "@/lib/usuarios";

export default function Page() {
  return (
    <PageFrame
      titulo="Registrar entradas"
      descripcion="Escanea el QR de la paleta. El token se consulta en el otro dashboard y, si el producto coincide, aquí se guarda la entrada."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Entradas />
      </Suspense>
    </PageFrame>
  );
}

async function Entradas() {
  await connection();
  const db = getDb();
  const sesion = await leerSesion();
  const [entradas, reporte] = await Promise.all([
    listarEntradas(db),
    sesion?.rango === "administrador" ? leerReporteKardex(db) : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-8">
      {sesion?.rango === "administrador" ? <EstadoTunel reporte={reporte} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Nueva entrada</CardTitle>
          <CardDescription>
            El QR solo trae el token. Si el kárdex externo está configurado, de ahí salen el producto, el código, el lote, el vencimiento y la cantidad. Si no responde, se usa la copia local o se completa la entrada a mano. Sin el kárdex configurado, esta prueba local ya conoce la paleta de sal de la foto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EntradaPorQr />
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Entradas registradas</CardTitle>
          <CardDescription>Cada token queda guardado una sola vez, con la copia de lo que devolvió el otro dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <TablaEntradas entradas={entradas} />
        </CardContent>
      </Card>
    </div>
  );
}

function EstadoTunel({ reporte }: { reporte: { url: string; actualizadoEn: string } | null }) {
  return (
    <p className="rounded-xl border bg-white px-4 py-3 text-sm text-muted-foreground">
      {reporte ? (
        <>
          Túnel del kárdex: <span className="font-mono text-foreground break-all">{reporte.url}</span>.
          Reportado el {textoReporte(reporte.actualizadoEn)}.
        </>
      ) : (
        "Todavía no llegó un reporte del túnel. Si hace falta, se usa la dirección guardada en el servidor."
      )}
    </p>
  );
}

function textoReporte(iso: string) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}
