"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { prepararEntrada, recibirPaleta, type EntradaPaleta, type PreparacionPaleta } from "@/lib/entrada-paleta";
import type { Resultado } from "@/lib/lotes";
import { exigirRango } from "@/lib/usuarios";

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
