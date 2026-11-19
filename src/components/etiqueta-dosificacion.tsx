import Link from "next/link";
import { BotonImprimir } from "@/components/boton-imprimir";
import { textoDestino } from "@/lib/destino-dosificacion";
import { svgQrDosificacion, type DatosEtiquetaDosificacion } from "@/lib/etiqueta-dosificacion";
import { ZONA_HORARIA, formatoFecha, formatoHora, formatoKg } from "@/lib/formato";

export function EtiquetaDosificacion({
  datos,
  volverHref = "/salidas",
  controles = true,
  anulada = false,
}: {
  datos: DatosEtiquetaDosificacion;
  volverHref?: string;
  controles?: boolean | "imprimir";
  anulada?: boolean;
}) {
  const svg = svgQrDosificacion(datos);
  const dia = diaEnCaracas(datos.creadoEn);
  return (
    <article className="etiqueta-dosificacion mx-auto w-full min-w-0 max-w-xl break-inside-avoid overflow-hidden rounded-xl border bg-white p-4 text-[#071422]">
      {controles ? (
      <div className="mb-3 flex items-center justify-between gap-3 print:hidden">
        {controles === "imprimir" ? <span /> : (
          <Link href={volverHref} className="text-sm underline">
            Volver
          </Link>
        )}
        <BotonImprimir etiqueta="Imprimir" />
      </div>
      ) : null}
      {anulada ? (
        <p className="mb-3 rounded-md bg-red-600 px-2 py-1.5 text-center text-xs font-semibold tracking-wide text-white uppercase">
          Anulada
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-3 border-b pb-2">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-purolomo.png" alt="Purolomo" className="mb-1 h-7 w-auto object-contain" />
          <p className="text-xs font-semibold text-[#e30613]">Dosificación de paleta</p>
        </div>
        <p className="font-mono text-lg font-bold">#{datos.id}</p>
      </div>
      <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-[12rem_1fr]">
        <div
          className="mx-auto w-full min-w-0 max-w-48 rounded-md bg-white [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <dl className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-2">
          <Dato etiqueta="Producto" valor={datos.descripcion} />
          <Dato etiqueta="Código" valor={datos.codigo} />
          <Dato etiqueta="Kg totales" valor={formatoKg(datos.pesoTotal)} />
          <Dato etiqueta="Kg por unidad" valor={formatoKg(datos.pesoUnitario)} />
          <Dato etiqueta="Unidades" valor={String(datos.cantidad)} />
          <Dato etiqueta="Núcleo" valor={datos.nucleo} />
          <Dato etiqueta="Destino" valor={textoDestino(datos.destino, datos.destinoCodigo)} />
          <Dato etiqueta="Fecha" valor={`${formatoFecha(dia)} ${formatoHora(datos.creadoEn)}`.trim()} />
        </dl>
      </div>
    </article>
  );
}

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

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[9px] tracking-wide text-neutral-500 uppercase">{etiqueta}</dt>
      <dd className="font-medium break-words">{valor}</dd>
    </div>
  );
}
