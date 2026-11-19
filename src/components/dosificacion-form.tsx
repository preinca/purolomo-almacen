"use client";

import { useMemo, useState, useTransition } from "react";
import { anularRegistroDosificacion, consultarPaletaDosificacion, registrarDosificacion } from "@/app/dosificacion-acciones";
import { EtiquetaDosificacion } from "@/components/etiqueta-dosificacion";
import { EscanerToken } from "@/components/escaner-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type DestinoDosificacion } from "@/lib/destino-dosificacion";
import type { DatosEtiquetaDosificacion } from "@/lib/etiqueta-dosificacion";
import { pesoTotalPaleta } from "@/lib/peso-paleta";
import { formatoKg } from "@/lib/formato";

export function DosificacionForm({ destino }: { destino: DestinoDosificacion }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [manual, setManual] = useState(false);
  const [disponibles, setDisponibles] = useState<number | null>(null);
  const [nucleo, setNucleo] = useState("");
  const [peso, setPeso] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [etiqueta, setEtiqueta] = useState<DatosEtiquetaDosificacion | null>(null);

  const total = useMemo(() => {
    const unitario = Number(peso.replace(",", "."));
    const unidades = Number(cantidad);
    return pesoTotalPaleta(unitario, unidades);
  }, [peso, cantidad]);

  function consultar(leido: string) {
    setError(null);
    setAviso(null);
    setNota(null);
    setToken(leido);
    iniciar(async () => {
      const resultado = await consultarPaletaDosificacion(leido);
      if (!resultado.ok) {
        setManual(true);
        setCodigo("");
        setDescripcion("");
        setError(resultado.error);
        return;
      }
      setToken(resultado.value.token);
      setCodigo(resultado.value.codigo);
      setDescripcion(resultado.value.descripcion);
      setManual(resultado.value.origen === "manual" || !resultado.value.descripcion);
      setDisponibles(resultado.value.kgDisponibles);
      setNota(
        resultado.value.descripcion
          ? null
          : "No se encontró el nombre. Escríbelo junto con el código.",
      );
    });
  }

  function guardar() {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = await registrarDosificacion({
        token,
        codigo,
        descripcion,
        nucleo,
        pesoUnitario: peso,
        cantidad,
        destino,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setAviso(`Dosificación guardada: ${descripcion || codigo}, ${formatoKg(resultado.value.pesoTotal)}.`);
      setEtiqueta(resultado.value);
      setNucleo("");
      setPeso("");
      setCantidad("");
    });
  }

  return (
    <div className="grid gap-6">
      {aviso ? (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">{aviso}</p>
      ) : null}
      {etiqueta ? <EtiquetaDosificacion datos={etiqueta} /> : null}
      {nota ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">{nota}</p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-950">{error}</p>
      ) : null}
      <EscanerToken onToken={consultar} />
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const escrito = String(form.get("token") ?? "");
          if (!codigo && !descripcion) consultar(escrito);
          else guardar();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="token-dosi">Token de la paleta</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="token-dosi"
              name="token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="PLT-MPCM01009-1009111126-6-59651802"
              className="font-mono"
              autoCapitalize="characters"
            />
            <Button type="button" variant="outline" disabled={pendiente} onClick={() => consultar(token)}>
              {pendiente ? "Consultando…" : "Consultar"}
            </Button>
          </div>
        </div>
        {disponibles !== null ? (
          <p className="text-sm text-muted-foreground">
            Disponibles en esta paleta: <span className="font-semibold text-foreground">{formatoKg(disponibles)}</span>
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="codigo-dosi">Código</Label>
            <Input id="codigo-dosi" value={codigo} onChange={(event) => setCodigo(event.target.value)} readOnly={!manual && !!descripcion} className="font-mono" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="desc-dosi">Producto</Label>
            <Input id="desc-dosi" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} readOnly={!manual && !!descripcion} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nucleo-dosi">Número de núcleo</Label>
            <Input id="nucleo-dosi" value={nucleo} onChange={(event) => setNucleo(event.target.value)} required autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="peso-dosi">Peso unitario (kg)</Label>
            <Input id="peso-dosi" inputMode="decimal" value={peso} onChange={(event) => setPeso(event.target.value)} required placeholder="1.25" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cant-dosi">Cantidad de unidades</Label>
            <Input id="cant-dosi" inputMode="numeric" value={cantidad} onChange={(event) => setCantidad(event.target.value)} required placeholder="8" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="total-dosi">Peso total de la paleta (kg)</Label>
            <Input id="total-dosi" readOnly value={total === null ? "" : String(total)} className="bg-muted" />
          </div>
        </div>
        <Button type="submit" disabled={pendiente || total === null}>
          {pendiente ? "Guardando…" : "Guardar dosificación"}
        </Button>
      </form>
    </div>
  );
}

export function AnularDosificacion({ id }: { id: number }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      className="text-sm underline"
      onClick={() => {
        if (!confirm("¿Anular esta dosificación? Los kilos vuelven a la paleta.")) return;
        iniciar(async () => {
          await anularRegistroDosificacion(id);
        });
      }}
    >
      {pendiente ? "Anulando…" : "Anular"}
    </button>
  );
}
