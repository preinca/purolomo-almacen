"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { confirmarEntradaPaleta, prepararEntradaPaleta } from "@/app/entradas-paleta-acciones";
import { EscanerToken } from "@/components/escaner-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PreparacionPaleta } from "@/lib/entrada-paleta";
import { formatoFecha, formatoKg } from "@/lib/formato";

export function EntradaPorQr() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<PreparacionPaleta, { ok: true }> | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  function consultar(token: string) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = await prepararEntradaPaleta(token);
      if (!resultado.ok) {
        setPreview(null);
        setError(resultado.error);
        return;
      }
      setPreview(resultado);
    });
  }

  function confirmar() {
    if (!preview || preview.yaRegistrada) return;
    setError(null);
    iniciar(async () => {
      const resultado = await confirmarEntradaPaleta(preview.paleta.token);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setAviso(`Entrada registrada: ${resultado.value.producto}, ${formatoKg(resultado.value.kg)}.`);
      setPreview(null);
      formulario.current?.reset();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      {aviso ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-5 text-lg font-semibold leading-snug text-emerald-950">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-5 py-5 text-lg font-semibold leading-snug text-red-950">
          {error}
        </p>
      ) : null}
      <EscanerToken onToken={consultar} />
      <form
        ref={formulario}
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          consultar(String(new FormData(event.currentTarget).get("token") ?? ""));
        }}
      >
        <Label htmlFor="token">Token de la paleta</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="token"
            name="token"
            placeholder="PLT-MPCM01009-1009111126-6-59651802"
            autoCapitalize="characters"
            className="font-mono"
          />
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Consultando…" : "Consultar"}
          </Button>
        </div>
      </form>
      {preview ? <Ficha paleta={preview} pendiente={pendiente} onConfirmar={confirmar} /> : null}
    </div>
  );
}

function Ficha({
  paleta,
  pendiente,
  onConfirmar,
}: {
  paleta: Extract<PreparacionPaleta, { ok: true }>;
  pendiente: boolean;
  onConfirmar: () => void;
}) {
  const datos = paleta.paleta;
  return (
    <div className="grid gap-4 rounded-xl border bg-white p-5">
      <p className={paleta.yaRegistrada ? "text-sm font-semibold text-amber-800" : "text-sm font-semibold text-emerald-800"}>
        {paleta.yaRegistrada
          ? "Esta paleta ya está registrada. No se creó otra entrada."
          : "El otro dashboard devolvió esta paleta. Confirma para registrarla."}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Dato etiqueta="Producto" valor={datos.producto} />
        <Dato etiqueta="Código" valor={datos.codigo} />
        <Dato etiqueta="Kilos" valor={formatoKg(datos.kg)} />
        <Dato etiqueta="Lote" valor={datos.lote} />
        <Dato etiqueta="Vencimiento" valor={formatoFecha(datos.vencimiento)} />
        <Dato etiqueta="Token" valor={datos.token} />
      </dl>
      {paleta.yaRegistrada ? null : (
        <button
          type="button"
          disabled={pendiente}
          onClick={onConfirmar}
          className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-green-600 px-6 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-60 sm:h-14 sm:text-base"
        >
          {pendiente ? "Registrando…" : "Registrar entrada"}
        </button>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{etiqueta}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold break-all">{valor}</dd>
    </div>
  );
}
