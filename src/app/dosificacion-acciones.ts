"use server";

import { revalidatePath } from "next/cache";
import { consultarProductoDosificacion, guardarDosificacion, pesoTotalPaleta, type ProductoDosificacion } from "@/lib/dosificacion";
import { getDb } from "@/lib/db";
import type { Resultado } from "@/lib/lotes";
import { exigirRango } from "@/lib/usuarios";

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
}): Promise<Resultado<{ pesoTotal: number }>> {
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
    },
    sesion.usuario,
  );
  if (!resultado.ok) return resultado;
  revalidatePath("/salidas");
  revalidatePath("/historial/salidas");
  return { ok: true, value: { pesoTotal: resultado.value.pesoTotal } };
}
