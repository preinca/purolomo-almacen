"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { guardarPlanBatches, guardarSolicitud } from "@/app/calculadora-acciones";
import { Button } from "@/components/ui/button";
import {
  DIAS,
  NOMBRE_DIA,
  calcularEmpaque,
  calcularMpnc,
  sumaBatches,
  type BatchesDia,
  type Dia,
  type FilaPlan,
  type RecetaCalc,
} from "@/lib/calculadora";
import { formatoNumero } from "@/lib/formato";

const CORTO: Record<Dia, string> = {
  lunes: "Lu",
  martes: "Ma",
  miercoles: "Mi",
  jueves: "Ju",
  viernes: "Vi",
};

type Paso = "mpnc" | "empaque";

function claveBorrador(id: number) {
  return `solicitud-mpnc-${id}`;
}

function leerCantidad(texto: string) {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero < 0) return undefined;
  return numero;
}

export function SolicitudMpnc({
  id,
  semana,
  anio,
  filas,
  recetas,
  puedeEditar,
  pasoInicial = "mpnc",
}: {
  id: number;
  semana: number;
  anio: number;
  filas: (FilaPlan & { batches: BatchesDia })[];
  recetas: RecetaCalc[];
  puedeEditar: boolean;
  pasoInicial?: Paso;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(pasoInicial);
  const [valores, setValores] = useState(() => new Map(filas.map((fila) => [fila.orden, { ...fila.batches }])));
  const [pedidos, setPedidos] = useState<Map<string, string>>(() => new Map());
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [listo, setListo] = useState(false);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    setPaso(pasoInicial);
  }, [pasoInicial]);

  useEffect(() => {
    try {
      const texto = sessionStorage.getItem(claveBorrador(id));
      if (!texto) return;
      const borrador = JSON.parse(texto) as {
        paso?: Paso;
        valores?: Record<string, BatchesDia>;
        pedidos?: Record<string, string>;
      };
      if (borrador.valores) {
        setValores((actual) => {
          const siguiente = new Map(actual);
          for (const [orden, batches] of Object.entries(borrador.valores ?? {})) {
            siguiente.set(Number(orden), { ...batches });
          }
          return siguiente;
        });
      }
      if (borrador.pedidos) setPedidos(new Map(Object.entries(borrador.pedidos)));
    } catch {
      sessionStorage.removeItem(claveBorrador(id));
    } finally {
      setListo(true);
    }
  }, [id]);

  useEffect(() => {
    if (!listo || !puedeEditar) return;
    const valoresPlanos: Record<string, BatchesDia> = {};
    for (const [orden, batches] of valores) valoresPlanos[String(orden)] = batches;
    sessionStorage.setItem(
      claveBorrador(id),
      JSON.stringify({ paso, valores: valoresPlanos, pedidos: Object.fromEntries(pedidos) }),
    );
  }, [id, listo, paso, valores, pedidos, puedeEditar]);

  const porFila = valores;
  const mpnc = useMemo(
    () => calcularMpnc(filas, recetas, porFila).filter((fila) => (fila.cantidad ?? 0) > 0),
    [filas, recetas, porFila],
  );
  const empaque = useMemo(
    () =>
      calcularEmpaque(filas, recetas, porFila).sort((a, b) => {
        const peso = (fila: { cantidad: number | null }) => ((fila.cantidad ?? 0) > 0 ? 0 : 1);
        const porPeso = peso(a) - peso(b);
        if (porPeso !== 0) return porPeso;
        if (a.codigo < b.codigo) return -1;
        if (a.codigo > b.codigo) return 1;
        return 0;
      }),
    [filas, recetas, porFila],
  );
  const texto = busqueda.trim().toLowerCase();
  const grupos = useMemo(() => {
    const lista: { planta: string; filas: (FilaPlan & { batches: BatchesDia })[] }[] = [];
    for (const fila of filas) {
      if (texto && !fila.nombre.toLowerCase().includes(texto) && !fila.planta.toLowerCase().includes(texto)) continue;
      const ultimo = lista.at(-1);
      if (!ultimo || ultimo.planta !== fila.planta) lista.push({ planta: fila.planta, filas: [fila] });
      else ultimo.filas.push(fila);
    }
    return lista;
  }, [filas, texto]);
  const empaqueVisible = empaque.filter((fila) => {
    if (!texto) return true;
    return fila.nombre.toLowerCase().includes(texto) || fila.codigo.toLowerCase().includes(texto);
  });
  const conBatches = filas.filter((fila) => sumaBatches(valores.get(fila.orden) ?? fila.batches) > 0).length;

  function cambiar(orden: number, dia: Dia, valor: string) {
    const numero = valor.trim() === "" ? 0 : Number(valor.replace(",", "."));
    setValores((actual) => {
      const siguiente = new Map(actual);
      const previo = siguiente.get(orden) ?? { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 };
      siguiente.set(orden, { ...previo, [dia]: Number.isFinite(numero) && numero > 0 ? numero : 0 });
      return siguiente;
    });
  }

  function batchesActuales() {
    return filas.map((fila) => ({ orden: fila.orden, batches: valores.get(fila.orden) ?? fila.batches }));
  }

  function siguiente() {
    setError(null);
    setBusqueda("");
    if (!puedeEditar) {
      setPaso("empaque");
      return;
    }
    iniciar(async () => {
      const resultado = await guardarPlanBatches(id, batchesActuales());
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setPaso("empaque");
      router.replace(`/calculadora/${id}?paso=empaque`);
    });
  }

  function pedirGuardar() {
    for (const fila of empaque) {
      const cantidad = leerCantidad(pedidos.get(fila.codigo) ?? "");
      if (cantidad === undefined) {
        setError(`Revisa la cantidad de ${fila.nombre}.`);
        setConfirmar(false);
        return;
      }
    }
    setError(null);
    setConfirmar(true);
  }

  function guardar() {
    setError(null);
    iniciar(async () => {
      const pedidosEmpaque = empaque.map((fila) => ({
        codigo: fila.codigo,
        tipo: "empaque" as const,
        cantidad: leerCantidad(pedidos.get(fila.codigo) ?? "") ?? null,
      }));
      const pedidosMpnc = mpnc.map((fila) => ({
        codigo: fila.codigo,
        tipo: "mpnc" as const,
        cantidad: fila.cantidad,
      }));
      const resultado = await guardarSolicitud(id, batchesActuales(), [...pedidosMpnc, ...pedidosEmpaque]);
      if (!resultado.ok) {
        setError(resultado.error);
        setConfirmar(false);
        return;
      }
      sessionStorage.removeItem(claveBorrador(id));
      router.push(`/calculadora/${id}/imprimir`);
    });
  }

  return (
    <div className="grid gap-4">
      <ol className="grid grid-cols-2 gap-2 text-sm font-medium">
        <li className={paso === "mpnc" ? "rounded-full bg-primary px-3 py-2 text-center text-primary-foreground" : "rounded-full bg-muted px-3 py-2 text-center text-muted-foreground"}>
          1 · Materia prima
        </li>
        <li className={paso === "empaque" ? "rounded-full bg-primary px-3 py-2 text-center text-primary-foreground" : "rounded-full bg-muted px-3 py-2 text-center text-muted-foreground"}>
          2 · Empaque
        </li>
      </ol>

      {error ? <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-950">{error}</p> : null}

      <label className="grid gap-1">
        <span className="sr-only">Buscar</span>
        <input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder={paso === "mpnc" ? "Buscar producto" : "Buscar material de empaque"}
          className="h-12 w-full rounded-2xl border bg-white px-4 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/40"
        />
      </label>

      {paso === "mpnc" ? (
        <div className="grid gap-5">
          <p className="text-sm text-muted-foreground">
            Anota los batches de lunes a viernes. {conBatches === 0 ? "Todavía no hay productos." : `${conBatches} ${conBatches === 1 ? "producto con producción" : "productos con producción"}.`}
          </p>
          {grupos.map((grupo) => (
            <section key={grupo.planta} className="grid gap-3">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{grupo.planta}</h2>
              {grupo.filas.map((fila) => {
                const batches = valores.get(fila.orden) ?? fila.batches;
                const total = sumaBatches(batches);
                return (
                  <article key={fila.orden} className="rounded-2xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold leading-tight">{fila.nombre}</h3>
                      <p className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-sm font-semibold">{formatoNumero(total, total % 1 === 0 ? 0 : 2)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {DIAS.map((dia) => (
                        <label key={dia} className="grid gap-1 text-center">
                          <span className="text-[11px] font-medium text-muted-foreground">{CORTO[dia]}</span>
                          <input
                            inputMode="decimal"
                            disabled={!puedeEditar}
                            aria-label={`${fila.nombre} ${NOMBRE_DIA[dia]}`}
                            value={batches[dia] ? String(batches[dia]) : ""}
                            placeholder="0"
                            onChange={(event) => cambiar(fila.orden, dia, event.target.value)}
                            className="h-12 w-full rounded-xl border bg-background text-center text-lg font-medium outline-none focus:border-ring focus:ring-3 focus:ring-ring/40 disabled:opacity-60"
                          />
                        </label>
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
          <section className="rounded-2xl border bg-white p-4">
            <h2 className="text-sm font-semibold">Materia prima de la semana {semana}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Año {anio}. Estos kilos salen de los batches y de la receta.</p>
            <ul className="mt-3 grid gap-2">
              {mpnc.length === 0 ? <li className="text-sm text-muted-foreground">Aparecen cuando anotas batches.</li> : null}
              {mpnc.map((total) => (
                <li key={total.codigo} className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0">
                  <span>
                    <span className="block font-medium">{total.nombre}</span>
                    <span className="font-mono text-xs text-muted-foreground">{total.codigo}</span>
                  </span>
                  <span className="font-semibold">{formatoNumero(total.cantidad ?? 0, 3)} kg</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Escribe cuánto empaque vas a pedir. Si lo dejas vacío, se usa la cantidad calculada. Si no hay cálculo, queda en blanco.
          </p>
          {empaque.length === 0 ? (
            <p className="rounded-2xl border bg-white px-4 py-6 text-sm text-muted-foreground">No hay empaque para los productos de esta semana. Vuelve y anota los batches.</p>
          ) : null}
          {empaqueVisible.map((fila) => (
            <article key={fila.codigo} className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold leading-tight">{fila.nombre}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{fila.codigo}</p>
                </div>
                <p className="shrink-0 text-xs font-medium text-muted-foreground">{fila.unidad}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {fila.cantidad === null ? "Sin cálculo en la receta." : `Según los batches: ${formatoNumero(fila.cantidad, 3)} ${fila.unidad}`}
              </p>
              <label className="mt-3 grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Cantidad a pedir</span>
                <input
                  inputMode="decimal"
                  disabled={!puedeEditar}
                  aria-label={`Cantidad de ${fila.nombre}`}
                  value={pedidos.get(fila.codigo) ?? ""}
                  placeholder={fila.cantidad === null ? "0" : formatoNumero(fila.cantidad, 3)}
                  onChange={(event) => {
                    const valor = event.target.value;
                    setPedidos((actual) => {
                      const siguiente = new Map(actual);
                      siguiente.set(fila.codigo, valor);
                      return siguiente;
                    });
                  }}
                  className="h-12 w-full rounded-xl border bg-background px-3 text-lg font-medium outline-none focus:border-ring focus:ring-3 focus:ring-ring/40 disabled:opacity-60"
                />
              </label>
            </article>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-3 flex gap-2 border-t bg-background/95 px-3 py-3 backdrop-blur sm:-mx-0 sm:px-0">
        {paso === "empaque" ? (
          <Button type="button" variant="outline" className="h-12 flex-1" disabled={pendiente} onClick={() => { setConfirmar(false); setBusqueda(""); setPaso("mpnc"); router.replace(`/calculadora/${id}`); }}>
            Volver
          </Button>
        ) : null}
        {paso === "mpnc" ? (
          <Button type="button" className="h-12 flex-1 text-base" disabled={pendiente} onClick={siguiente}>
            {pendiente ? "Guardando…" : "Siguiente"}
          </Button>
        ) : puedeEditar ? (
          <Button type="button" className="h-12 flex-1 text-base" disabled={pendiente} onClick={pedirGuardar}>
            Guardar
          </Button>
        ) : null}
      </div>

      {confirmar ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="confirmar-solicitud" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="confirmar-solicitud" className="text-lg font-semibold">¿Guardar esta solicitud?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Semana {semana} de {anio}. Si confirmas, queda guardada para verla e imprimirla. Ya no se podrá modificar.
            </p>
            <div className="mt-4 grid gap-2">
              <Button type="button" className="h-12" disabled={pendiente} onClick={guardar}>
                {pendiente ? "Guardando…" : "Sí, guardar"}
              </Button>
              <Button type="button" variant="outline" className="h-12" disabled={pendiente} onClick={() => setConfirmar(false)}>
                Seguir editando
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
