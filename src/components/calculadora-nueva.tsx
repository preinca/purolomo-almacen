"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearSemana } from "@/app/calculadora-acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NuevaSemana({ anio, hayAnterior }: { anio: number; hayAnterior: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <form
      className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-4 sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        iniciar(async () => {
          const resultado = await crearSemana(Number(form.get("anio")), Number(form.get("semana")), form.get("copiar") === "on");
          if (!resultado.ok) {
            setError(resultado.error);
            return;
          }
          router.push(`/calculadora/${resultado.id}`);
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="anio">Año</Label>
        <Input id="anio" name="anio" type="number" required defaultValue={anio} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="semana">Semana</Label>
        <Input id="semana" name="semana" type="number" min={1} max={53} required placeholder="45" />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="copiar" defaultChecked={hayAnterior} />
        Copiar la semana anterior
      </label>
      {error ? <p className="text-sm font-medium text-red-800 sm:col-span-4">{error}</p> : null}
      <Button type="submit" disabled={pendiente} className="sm:col-span-2">{pendiente ? "Creando…" : "Crear semana"}</Button>
    </form>
  );
}
