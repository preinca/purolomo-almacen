"use client";

import { useMemo, useState } from "react";
import { EtiquetaDosificacion } from "@/components/etiqueta-dosificacion";
import { CATALOGO_DESTINOS, textoDestino } from "@/lib/destino-dosificacion";
import type { DatosEtiquetaDosificacion } from "@/lib/etiqueta-dosificacion";
import { ZONA_HORARIA, formatoFecha } from "@/lib/formato";

export type EtiquetaListada = DatosEtiquetaDosificacion & { anulada: boolean; token: string };

export function GaleriaEtiquetas({ etiquetas }: { etiquetas: EtiquetaListada[] }) {
  const [destino, setDestino] = useState("");
  const [producto, setProducto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [elegidas, setElegidas] = useState<number[]>([]);

  const productos = useMemo(() => {
    const nombres = new Map<string, string>();
    for (const etiqueta of etiquetas) {
      nombres.set(etiqueta.codigo, etiqueta.descripcion);
    }
    return [...nombres.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [etiquetas]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return etiquetas.filter((etiqueta) => {
      const dia = diaEnCaracas(etiqueta.creadoEn);
      if (destino && etiqueta.destino !== destino) return false;
      if (producto && etiqueta.codigo !== producto) return false;
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      if (!texto) return true;
      const bolsa = [
        etiqueta.descripcion,
        etiqueta.codigo,
        etiqueta.nucleo,
        etiqueta.token,
        textoDestino(etiqueta.destino, etiqueta.destinoCodigo),
      ]
        .join(" ")
        .toLowerCase();
      return bolsa.includes(texto);
    });
  }, [busqueda, desde, destino, etiquetas, hasta, producto]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, EtiquetaListada[]>();
    for (const etiqueta of visibles) {
      const dia = diaEnCaracas(etiqueta.creadoEn);
      const lista = mapa.get(dia) ?? [];
      lista.push(etiqueta);
      mapa.set(dia, lista);
    }
    return [...mapa.entries()];
  }, [visibles]);

  function alternar(id: number) {
    setElegidas((actual) => (actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]));
  }

  function imprimirSeleccion() {
    window.print();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 rounded-xl border bg-white p-4 print:hidden sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Destino
          <select value={destino} onChange={(event) => setDestino(event.target.value)} className="h-11 rounded-lg border bg-white px-3">
            <option value="">Todos</option>
            {CATALOGO_DESTINOS.map((item) => (
              <option key={item.id} value={item.id}>
                {textoDestino(item.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Producto
          <select value={producto} onChange={(event) => setProducto(event.target.value)} className="h-11 rounded-lg border bg-white px-3">
            <option value="">Todos</option>
            {productos.map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {nombre} · {codigo}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Buscar
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Producto, código, núcleo o token"
            className="h-11 rounded-lg border px-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Desde
          <input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="h-11 rounded-lg border px-3" />
        </label>
        <label className="grid gap-1 text-sm">
          Hasta
          <input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="h-11 rounded-lg border px-3" />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={elegidas.length === 0}
            onClick={imprimirSeleccion}
            className="h-11 rounded-lg bg-purolomo-red px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Imprimir seleccionadas ({elegidas.length})
          </button>
        </div>
      </div>
      {grupos.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No hay etiquetas con esos filtros.
        </p>
      ) : (
        grupos.map(([dia, lista]) => (
          <section key={dia} className="grid gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{formatoFecha(dia)}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {lista.map((etiqueta) => {
                const elegida = elegidas.includes(etiqueta.id);
                return (
                  <div key={etiqueta.id} className={elegidas.length > 0 && !elegida ? "print:hidden" : ""}>
                    <label className="mb-2 flex items-center gap-2 text-sm print:hidden">
                      <input type="checkbox" checked={elegida} onChange={() => alternar(etiqueta.id)} />
                      Seleccionar
                      <a href={`/historial/salidas/${etiqueta.id}`} className="ml-auto underline">
                        Ver
                      </a>
                    </label>
                    <EtiquetaDosificacion datos={etiqueta} controles={false} anulada={etiqueta.anulada} />
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
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
