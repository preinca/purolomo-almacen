"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { confirmarEntradaPaleta, prepararEntradaPaleta, registrarEntradaManualPaleta } from "@/app/entradas-paleta-acciones";
import { EscanerToken } from "@/components/escaner-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DatosManuales, PreparacionPaleta } from "@/lib/entrada-paleta";
import { fechaValida, formatoKg, textoVencimiento } from "@/lib/formato";

export function EntradaPorQr() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<PreparacionPaleta, { ok: true }> | null>(null);
  const [manual, setManual] = useState<DatosManuales | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  function consultar(token: string) {
    setError(null);
    setAviso(null);
    setNota(null);
    setManual(null);
    setPreview(null);
    iniciar(async () => {
      const resultado = await prepararEntradaPaleta(token);
      if (!resultado.ok) {
        setPreview(null);
        if (resultado.manual) {
          setManual(resultado.manual);
          setNota(resultado.error);
          return;
        }
        setError(resultado.error);
        return;
      }
      setPreview(resultado);
      setNota(resultado.yaRegistrada ? null : (resultado.aviso ?? null));
    });
  }

  function confirmar(opcion: { vencimiento?: string; noAplica?: boolean }) {
    if (!preview || preview.yaRegistrada) return;
    setError(null);
    iniciar(async () => {
      const resultado = await confirmarEntradaPaleta(preview.paleta.token, opcion.vencimiento, opcion.noAplica === true);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setAviso(`Entrada registrada: ${resultado.value.producto}, ${formatoKg(resultado.value.kg)}.`);
      setNota(null);
      setPreview(null);
      formulario.current?.reset();
      router.refresh();
    });
  }

  function registrarManual(campos: { producto: string; kg: string; vencimiento: string; noAplica: boolean }) {
    if (!manual) return;
    setError(null);
    iniciar(async () => {
      const resultado = await registrarEntradaManualPaleta({ token: manual.token, ...campos });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setAviso(`Entrada registrada: ${resultado.value.producto}, ${formatoKg(resultado.value.kg)}.`);
      setNota(null);
      setManual(null);
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
      {nota ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-5 text-base font-semibold leading-snug text-amber-950">
          {nota}
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
      {preview ? <Ficha key={preview.paleta.token} paleta={preview} pendiente={pendiente} onConfirmar={confirmar} onError={setError} /> : null}
      {manual ? (
        <FormularioManual key={manual.token} datos={manual} pendiente={pendiente} onRegistrar={registrarManual} onError={setError} />
      ) : null}
    </div>
  );
}

function Ficha({
  paleta,
  pendiente,
  onConfirmar,
  onError,
}: {
  paleta: Extract<PreparacionPaleta, { ok: true }>;
  pendiente: boolean;
  onConfirmar: (opcion: { vencimiento?: string; noAplica?: boolean }) => void;
  onError: (mensaje: string) => void;
}) {
  const datos = paleta.paleta;
  const faltaVencimiento = !paleta.yaRegistrada && paleta.faltaVencimiento === true;
  const yaSinFecha = paleta.yaRegistrada && paleta.paleta.vencimientoNoAplica;
  const texto = paleta.yaRegistrada
    ? "Esta paleta ya está registrada. No se creó otra entrada."
    : paleta.origenDatos === "kardex"
      ? "El kárdex externo devolvió esta paleta. Confirma para registrarla."
      : "El otro dashboard devolvió esta paleta. Confirma para registrarla.";
  return (
    <form
      className="grid gap-4 rounded-xl border bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (paleta.yaRegistrada) return;
        const form = new FormData(event.currentTarget);
        const noAplica = form.get("no-aplica") === "on";
        const vencimiento = String(form.get("vencimiento") ?? "");
        if (faltaVencimiento && !noAplica && !fechaValida(vencimiento)) {
          onError("Elige la fecha de vencimiento o marca que no aplica.");
          return;
        }
        onConfirmar(faltaVencimiento ? { vencimiento, noAplica } : {});
      }}
    >
      <p className={paleta.yaRegistrada ? "text-sm font-semibold text-amber-800" : "text-sm font-semibold text-emerald-800"}>
        {texto}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Dato etiqueta="Producto" valor={datos.producto} />
        <Dato etiqueta="Código" valor={datos.codigo} />
        <Dato etiqueta="Kilos" valor={formatoKg(datos.kg)} />
        <Dato etiqueta="Lote" valor={datos.lote} />
        {faltaVencimiento ? null : (
          <Dato etiqueta="Vencimiento" valor={textoVencimiento(datos.vencimiento, yaSinFecha)} />
        )}
        <Dato etiqueta="Token" valor={datos.token} />
      </dl>
      {faltaVencimiento ? <EleccionVencimiento pendiente={pendiente} idPrefijo="ficha" /> : null}
      {paleta.yaRegistrada ? null : (
        <button
          type="submit"
          disabled={pendiente}
          className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-green-600 px-6 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-60 sm:h-14 sm:text-base"
        >
          {pendiente ? "Registrando…" : "Registrar entrada"}
        </button>
      )}
    </form>
  );
}

function FormularioManual({
  datos,
  pendiente,
  onRegistrar,
  onError,
}: {
  datos: DatosManuales;
  pendiente: boolean;
  onRegistrar: (campos: { producto: string; kg: string; vencimiento: string; noAplica: boolean }) => void;
  onError: (mensaje: string) => void;
}) {
  return (
    <form
      className="grid gap-4 rounded-xl border bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const noAplica = form.get("no-aplica") === "on";
        const vencimiento = String(form.get("vencimiento") ?? "");
        if (!noAplica && !fechaValida(vencimiento)) {
          onError("Elige la fecha de vencimiento o marca que no aplica.");
          return;
        }
        onRegistrar({
          producto: String(form.get("producto") ?? ""),
          kg: String(form.get("kg") ?? ""),
          vencimiento,
          noAplica,
        });
      }}
    >
      <p className="text-sm font-semibold text-amber-800">
        El código y el lote salen del QR. Completa el producto y los kilos. Si la etiqueta trae vencimiento, escríbelo; si no aplica, márcalo.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Dato etiqueta="Código" valor={datos.codigo} />
        <Dato etiqueta="Lote" valor={datos.lote} />
      </dl>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5 sm:col-span-3">
          <Label htmlFor="producto-manual">Producto</Label>
          <Input id="producto-manual" name="producto" required disabled={pendiente} autoComplete="off" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kg-manual">Kilos</Label>
          <Input id="kg-manual" name="kg" inputMode="decimal" required disabled={pendiente} placeholder="1000" />
        </div>
        <div className="sm:col-span-2">
          <EleccionVencimiento pendiente={pendiente} idPrefijo="manual" />
        </div>
      </div>
      <button
        type="submit"
        disabled={pendiente}
        className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-green-600 px-6 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-60 sm:h-14 sm:text-base"
      >
        {pendiente ? "Registrando…" : "Registrar con estos datos"}
      </button>
    </form>
  );
}

function EleccionVencimiento({ pendiente, idPrefijo }: { pendiente: boolean; idPrefijo: string }) {
  const [noAplica, setNoAplica] = useState(false);
  return (
    <div className="grid gap-3">
      <label className="flex items-start gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="no-aplica"
          checked={noAplica}
          onChange={(event) => setNoAplica(event.target.checked)}
          disabled={pendiente}
          className="mt-0.5 size-4"
        />
        Fecha de vencimiento: No aplica
      </label>
      {noAplica ? null : (
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefijo}-vencimiento`}>Vencimiento</Label>
          <Input id={`${idPrefijo}-vencimiento`} name="vencimiento" type="date" disabled={pendiente} />
        </div>
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
