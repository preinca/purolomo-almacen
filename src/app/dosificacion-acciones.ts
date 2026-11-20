"use server";

import { revalidatePath } from "next/cache";
import { anularDosificacion, buscarDosificacion, consultarProductoDosificacion, guardarDosificacion, type Dosificacion, type ProductoDosificacion } from "@/lib/dosificacion";
import { datosEtiqueta, zplEtiquetaPaleta } from "@/lib/etiqueta-dosificacion";
import { encolarZpl } from "@/lib/impresion";
import { pesoTotalPaleta } from "@/lib/peso-paleta";
import { getDb } from "@/lib/db";
import type { Resultado } from "@/lib/lotes";
import { exigirRango, exigirSesion } from "@/lib/usuarios";

async function exigirDosificacion() {
  return exigirRango(["administrador", "pesador"]);
}

export async function consultarPaletaDosificacion(token: string): Promise<Resultado<ProductoDosificacion>> {
  await exigirDosificacion();
  return consultarProductoDosificacion(getDb(), token);
}

export async function registrarDosificacion(input: {
  token: string;
  codigo: string;
  descripcion: string;
  nucleo: string;
  pesoUnitario: string;
  cantidad: string;
  destino: string;
}): Promise<Resultado<Dosificacion>> {
  const sesion = await exigirDosificacion();
  const pesoUnitario = Number(input.pesoUnitario.trim().replace(",", "."));
  const cantidad = Number(input.cantidad.trim());
  const pesoTotal = pesoTotalPaleta(pesoUnitario, cantidad);
  if (pesoTotal === null) {
    return { ok: false, error: "Revisa el peso unitario y la cantidad de unidades." };
  }
  const resultado = await guardarDosificacion(
    getDb(),
    {
      token: input.token,
      codigo: input.codigo,
      descripcion: input.descripcion,
      nucleo: input.nucleo,
      pesoUnitario,
      cantidad,
      destino: input.destino,
    },
    sesion.usuario,
  );
  if (!resultado.ok) return resultado;
  revalidatePath("/salidas");
  revalidatePath("/entradas");
  revalidatePath("/historial/salidas");
  revalidatePath(`/historial/salidas/${resultado.value.id}`);
  return resultado;
}

export async function imprimirEtiquetaPaleta(id: number): Promise<Resultado> {
  await exigirSesion();
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Esa etiqueta no es válida." };
  const fila = await buscarDosificacion(getDb(), id);
  if (!fila) return { ok: false, error: "No se encontró esa etiqueta." };
  return encolarZpl(getDb(), zplEtiquetaPaleta(datosEtiqueta(fila)));
}

export async function anularRegistroDosificacion(id: number): Promise<Resultado> {
  await exigirDosificacion();
  const resultado = await anularDosificacion(getDb(), id);
  if (!resultado.ok) return resultado;
  revalidatePath("/salidas");
  revalidatePath("/entradas");
  revalidatePath("/historial/salidas");
  return resultado;
}
