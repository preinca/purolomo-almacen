"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agregarIngrediente, guardarCantidadReceta } from "@/app/calculadora-acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Item = {
  codigo: string;
  nombre: string;
  tipo: "mpnc" | "empaque";
  kgPorBatch: number | null;
  unidad: string;
  cantidadObservada: number | null;
  nota: string;
};

export function EditorReceta({ recetaId, items }: { recetaId: string; items: Item[] }) {
  const mpnc = items.filter((item) => item.tipo === "mpnc");
  const empaque = items.filter((item) => item.tipo === "empaque");
  return (
    <div className="grid gap-8">
      <Seccion titulo="MPNC, kilos por batch" recetaId={recetaId} items={mpnc} />
      <Seccion titulo="Empaque, cantidad por batch" recetaId={recetaId} items={empaque} />
      <Agregar recetaId={recetaId} />
    </div>
  );
}

function Seccion({ titulo, recetaId, items }: { titulo: string; recetaId: string; items: Item[] }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <ul className="grid gap-2">
        {items.length === 0 ? <li className="text-sm text-muted-foreground">No hay materiales.</li> : null}
        {items.map((item) => (
          <ItemFila key={`${item.tipo}-${item.codigo}`} recetaId={recetaId} item={item} />
        ))}
      </ul>
    </section>
  );
}

function ItemFila({ recetaId, item }: { recetaId: string; item: Item }) {
  const [texto, setTexto] = useState(item.kgPorBatch === null ? "" : String(item.kgPorBatch));
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <li className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-center">
      <div>
        <p className="font-medium">{item.nombre}</p>
        <p className="font-mono text-xs text-muted-foreground">{item.codigo} · {item.unidad}</p>
        {item.cantidadObservada !== null ? (
          <p className="text-xs text-muted-foreground">Último despacho anotado: {item.cantidadObservada}. No se multiplica por los batches.</p>
        ) : null}
      </div>
      <Input
        inputMode="decimal"
        aria-label={`Cantidad por batch de ${item.nombre}`}
        value={texto}
        placeholder={item.tipo === "empaque" ? "vacío" : "0"}
        disabled={pendiente}
        onChange={(event) => setTexto(event.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pendiente}
        onClick={() => {
          setAviso(null);
          iniciar(async () => {
            const resultado = await guardarCantidadReceta(recetaId, item.codigo, item.tipo, texto);
            setAviso(resultado.ok ? "Guardado" : resultado.error);
          });
        }}
      >
        Guardar
      </Button>
      {aviso ? <p className="text-xs text-muted-foreground sm:col-span-3">{aviso}</p> : null}
    </li>
  );
}

function Agregar({ recetaId }: { recetaId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form
      className="grid gap-3 rounded-xl border bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formulario = event.currentTarget;
        const form = new FormData(formulario);
        form.set("receta", recetaId);
        setError(null);
        iniciar(async () => {
          const resultado = await agregarIngrediente(form);
          if (!resultado.ok) {
            setError(resultado.error);
            return;
          }
          formulario.reset();
          router.refresh();
        });
      }}
    >
      <h2 className="font-semibold">Agregar</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          Tipo
          <select name="tipo" className="h-11 rounded-lg border px-2">
            <option value="mpnc">MPNC</option>
            <option value="empaque">Empaque</option>
          </select>
        </label>
        <div className="grid gap-1.5">
          <Label htmlFor="codigo-nuevo">Código</Label>
          <Input id="codigo-nuevo" name="codigo" required placeholder="MPCM01009" />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="nombre-nuevo">Nombre</Label>
          <Input id="nombre-nuevo" name="nombre" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kg-nuevo">Cantidad por batch</Label>
          <Input id="kg-nuevo" name="kg" inputMode="decimal" placeholder="vacío en empaque" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unidad-nueva">Unidad</Label>
          <Input id="unidad-nueva" name="unidad" placeholder="kg" />
        </div>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <Button type="submit" disabled={pendiente}>{pendiente ? "Agregando…" : "Agregar"}</Button>
    </form>
  );
}
