"use client";

import { useState, useTransition } from "react";
import { importarRecetasCsv } from "@/app/calculadora-acciones";
import { Button } from "@/components/ui/button";

export function ImportarCsv() {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setAviso(null);
        iniciar(async () => {
          const resultado = await importarRecetasCsv(texto);
          setAviso(resultado.ok ? `Se importaron ${resultado.value.n} filas.` : resultado.error);
        });
      }}
    >
      <textarea
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        required
        rows={10}
        className="w-full rounded-xl border bg-white p-3 font-mono text-sm"
        aria-label="CSV de recetas"
      />
      <label className="text-sm">
        O elige un archivo
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block w-full text-sm"
          onChange={(event) => {
            const archivo = event.target.files?.[0];
            if (!archivo) return;
            void archivo.text().then(setTexto);
          }}
        />
      </label>
      {aviso ? <p className="text-sm font-medium">{aviso}</p> : null}
      <Button type="submit" disabled={pendiente}>{pendiente ? "Importando…" : "Importar"}</Button>
    </form>
  );
}
