import { connection } from "next/server";
import { Suspense } from "react";
import { AnularDosificacion, DosificacionForm } from "@/components/dosificacion-form";
import { PageFrame } from "@/components/page-frame";
import { SalidaAlibal } from "@/components/salida-alibal";
import { SalidaLogistica } from "@/components/salida-logistica";
import { getDb } from "@/lib/db";
import { listarDosificaciones } from "@/lib/dosificacion";
import { fechaHoy, formatoKg } from "@/lib/formato";
import { leerSesion } from "@/lib/usuarios";
import { buscarPesaje, codigoDelPesaje, existenciasDeTipos, listarMiniLotes, pesajeEnCurso, progresoPesaje, siguienteNumero } from "@/lib/pesajes";
import { ALIBAL_1K, recetasCargadas } from "@/lib/recetas";

export default function Page({ searchParams }: PageProps<"/salidas">) {
  return (
    <PageFrame
      titulo="Dosificación"
      descripcion="Escanea el QR de la paleta que se está dosificando. El nombre sale del mismo token de la entrada."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Salidas searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Salidas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parametros = await searchParams;
  const pesajeId = Number(leer(parametros.pesaje));
  const token = leer(parametros.token);
  const aviso = leer(parametros.aviso);
  const tono = leer(parametros.tono);
  const modoPedido = leer(parametros.modo);
  const esAdmin = (await leerSesion())?.rango === "administrador";
  const modo =
    esAdmin && modoPedido === "logistica"
      ? "logistica"
      : modoPedido === "consumo" || pesajeId || token
        ? "consumo"
        : "";
  const pedidoProducto = leer(parametros.producto);
  const producto = pedidoProducto === ALIBAL_1K.destino || pesajeId || token ? ALIBAL_1K.destino : "";
  const db = getDb();
  const historial = modo === "" ? await listarDosificaciones(db) : [];
  const cargadas = (await recetasCargadas(db)).filter((receta) => receta.destino === producto);
  const enCurso = await pesajeEnCurso(db, producto);
  const encontrado = Number.isInteger(pesajeId) ? await buscarPesaje(db, pesajeId) : null;
  const pesaje = encontrado && encontrado.destino === producto ? encontrado : enCurso;
  const progreso = pesaje ? await progresoPesaje(db, pesaje) : null;
  const minilotes = pesaje ? await listarMiniLotes(db, pesaje.id) : [];

  return (
    <div className="grid gap-8">
      {aviso ? (
        <p
          role="status"
          className={
            tono === "ok"
              ? "rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-5 text-lg font-semibold leading-snug text-emerald-950 sm:px-6 sm:py-6 sm:text-xl"
              : "rounded-xl border px-4 py-3 text-sm"
          }
        >
          {aviso}
        </p>
      ) : null}
      {modo === "" ? (
        <div className="grid gap-8">
          <DosificacionForm />
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Dosificaciones registradas</h2>
            {historial.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay dosificaciones.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Núcleo</th>
                      <th className="px-3 py-2">Peso unitario</th>
                      <th className="px-3 py-2">Unidades</th>
                      <th className="px-3 py-2">Peso total</th>
                      <th className="px-3 py-2">Usuario</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((fila) => (
                      <tr key={fila.id} className="border-t">
                        <td className="px-3 py-2">
                          <span className="font-medium">{fila.descripcion}</span>
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{fila.codigo}</span>
                        </td>
                        <td className="px-3 py-2">{fila.nucleo}</td>
                        <td className="px-3 py-2">{formatoKg(fila.pesoUnitario)}</td>
                        <td className="px-3 py-2">{fila.cantidad}</td>
                        <td className="px-3 py-2 font-semibold">{formatoKg(fila.pesoTotal)}</td>
                        <td className="px-3 py-2">{fila.usuario}</td>
                        <td className="px-3 py-2">
                          {fila.anulada ? "Anulada" : <AnularDosificacion id={fila.id} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
      <div className={`grid gap-4 ${esAdmin ? "sm:grid-cols-2" : ""} ${modo === "" ? "hidden" : ""}`}>
        <a
          href="/salidas?modo=consumo"
          className={`grid content-center gap-2 rounded-2xl border px-6 ${modo === "" ? "py-10 sm:py-14" : "py-5"} ${
            modo === "consumo"
              ? "border-purolomo-red bg-purolomo-red text-white"
              : "border-border bg-white text-foreground hover:border-purolomo-red"
          }`}
        >
          <span className="text-xl font-semibold">Salida para consumo</span>
          <span className={`text-sm leading-relaxed ${modo === "consumo" ? "text-white/85" : "text-muted-foreground"}`}>
            Primero elige el producto. Después se pesa la fórmula y se escanea cada TAG.
          </span>
        </a>
        {esAdmin ? (
          <a
            href="/salidas?modo=logistica"
            className={`grid content-center gap-2 rounded-2xl border px-6 ${modo === "" ? "py-10 sm:py-14" : "py-5"} ${
              modo === "logistica"
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-border bg-white text-foreground hover:border-orange-500"
            }`}
          >
            <span className="text-xl font-semibold">Salida para logística</span>
            <span className={`text-sm leading-relaxed ${modo === "logistica" ? "text-white/85" : "text-muted-foreground"}`}>
              El TAG sale de la cava. Queda avisado que ya no se puede consumir.
            </span>
          </a>
        ) : null}
      </div>
      {modo === "" ? null : modo === "logistica" ? (
        <SalidaLogistica trasladado={leer(parametros.trasladado)} />
      ) : !producto ? (
        <div className="grid gap-3">
          <p className="text-sm font-medium text-muted-foreground">Elige el producto del pesaje</p>
          <a
            href={`/salidas?modo=consumo&producto=${encodeURIComponent(ALIBAL_1K.destino)}`}
            className="grid max-w-xl content-center gap-2 rounded-2xl border border-border bg-white px-6 py-8 text-foreground hover:border-purolomo-red"
          >
            <span className="text-xl font-semibold">ALIBAL 1 K</span>
            <span className="text-sm leading-relaxed text-muted-foreground">Alibal de 1 kg. Es el único producto para esta salida.</span>
          </a>
        </div>
      ) : (
    <div className="grid gap-8">
      <SalidaAlibal
            hoy={fechaHoy()}
            lineasConReceta={cargadas.map((receta) => receta.linea)}
            existencias={await existenciasDeTipos(db, progreso?.lineas.map((linea) => linea.tipo) ?? [])}
            numeroSiguiente={await siguienteNumero(db, enCurso?.fecha ?? fechaHoy(), producto)}
            token={token}
            enCurso={
              enCurso
                ? { id: enCurso.id, numero: enCurso.numero, linea: enCurso.linea, fecha: enCurso.fecha }
                : null
            }
            pesaje={
              pesaje && progreso
                ? {
                    id: pesaje.id,
                    numero: pesaje.numero,
                    fecha: pesaje.fecha,
                    destino: pesaje.destino,
                    linea: pesaje.linea,
                    objetivo: progreso.objetivo,
                    tolerancia: progreso.tolerancia,
                    minimo: progreso.minimo,
                    maximo: progreso.maximo,
                    total: progreso.total,
                    lineas: progreso.lineas,
                    codigo: await codigoDelPesaje(db, pesaje.id),
                    finalizado: pesaje.finalizado,
                    observaciones: pesaje.observaciones,
                    trazas: minilotes.map((mini) => ({
                      tipo: mini.tipo,
                      tag: mini.tag,
                      token: mini.token,
                      kg: mini.kg,
                    })),
                  }
                : null
            }
          />
    </div>
      )}
    </div>
  );
}

function leer(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}
