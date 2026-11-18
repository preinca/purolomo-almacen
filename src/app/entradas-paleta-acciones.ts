"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { prepararEntrada, recibirPaleta, recibirPaletaManual, type EntradaPaleta, type PreparacionPaleta } from "@/lib/entrada-paleta";
import { buscarPaletaKardex } from "@/lib/kardex-externo";
import type { Resultado } from "@/lib/lotes";
import { partirToken } from "@/lib/token-paleta";
import { exigirRango } from "@/lib/usuarios";

export type ConsultaKardex =
  | {
      ok: true;
      paleta: {
        token: string;
        codigo: string;
        descripcion: string;
        lote: string;
        fv: string;
        cantidad: number;
        unidad: string;
        mensaje: string;
      };
    }
  | { ok: false; error: string };

/** Consulta autenticada del token escaneado. No devuelve la cookie ni las claves. */
export async function consultarPaletaEnKardex(token: string): Promise<ConsultaKardex> {
  await exigirRango(["administrador", "recepcionista"]);
  const partes = partirToken(token);
  if (!partes.ok) return partes;
  const resultado = await buscarPaletaKardex(partes.value.token, getDb());
  if (!resultado.ok) return { ok: false, error: resultado.error };
  const paleta = resultado.value;
  return {
    ok: true,
    paleta: {
      token: partes.value.token,
      codigo: paleta.codigo || partes.value.codigo,
      descripcion: paleta.descripcion,
      lote: paleta.lote || partes.value.lote,
      fv: paleta.fv,
      cantidad: paleta.cantidad,
      unidad: paleta.unidad,
      mensaje: paleta.mensaje,
    },
  };
}

export async function prepararEntradaPaleta(token: string): Promise<PreparacionPaleta> {
  await exigirRango(["administrador", "recepcionista"]);
  return prepararEntrada(getDb(), token);
}

export async function confirmarEntradaPaleta(token: string): Promise<Resultado<EntradaPaleta>> {
  const sesion = await exigirRango(["administrador", "recepcionista"]);
  const resultado = await recibirPaleta(getDb(), token, sesion.usuario);
  if (resultado.ok) {
    revalidatePath("/");
    revalidatePath("/entradas");
  }
  return resultado;
}

export async function registrarEntradaManualPaleta(input: {
  token: string;
  producto: string;
  kg: string;
  vencimiento: string;
}): Promise<Resultado<EntradaPaleta>> {
  const sesion = await exigirRango(["administrador", "recepcionista"]);
  const resultado = await recibirPaletaManual(getDb(), input.token, sesion.usuario, {
    producto: input.producto,
    kg: input.kg,
    vencimiento: input.vencimiento,
  });
  if (resultado.ok) {
    revalidatePath("/");
    revalidatePath("/entradas");
  }
  return resultado;
}
