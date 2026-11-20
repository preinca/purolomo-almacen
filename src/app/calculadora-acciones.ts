"use server";

import { revalidatePath } from "next/cache";
import {
  agregarItemReceta,
  cerrarSolicitud,
  crearPlan,
  guardarBatches,
  guardarKgItem,
  guardarSolicitado,
  importarCsvReceta,
  planAnterior,
  prepararCalculadora,
} from "@/lib/calculadora-db";
import { parseCsvRecetas, type BatchesDia } from "@/lib/calculadora";
import { getDb } from "@/lib/db";
import type { Resultado } from "@/lib/lotes";
import { exigirRango } from "@/lib/usuarios";

async function exigirEdicion() {
  return exigirRango(["administrador", "recepcionista"]);
}

export async function crearSemana(anio: number, semana: number, copiar: boolean) {
  const sesion = await exigirEdicion();
  const db = getDb();
  await prepararCalculadora(db);
  const anterior = copiar ? await planAnterior(db, anio, semana) : undefined;
  const creado = await crearPlan(db, anio, semana, sesion.usuario, anterior ? Number(anterior.id) : undefined);
  if (!creado.ok) return creado;
  revalidatePath("/calculadora");
  return creado;
}

export async function guardarPlanBatches(
  id: number,
  filas: { orden: number; batches: BatchesDia }[],
): Promise<Resultado> {
  const sesion = await exigirEdicion();
  const resultado = await guardarBatches(getDb(), id, filas, sesion.usuario);
  if (!resultado.ok) return resultado;
  revalidatePath(`/calculadora/${id}`);
  revalidatePath(`/calculadora/${id}/resultado`);
  return { ok: true, value: undefined };
}

export async function guardarSolicitud(
  id: number,
  filas: { orden: number; batches: BatchesDia }[],
  pedidos: { codigo: string; tipo: "mpnc" | "empaque"; cantidad: number | null }[],
): Promise<Resultado> {
  const sesion = await exigirEdicion();
  const resultado = await cerrarSolicitud(getDb(), id, filas, pedidos, sesion.usuario);
  if (!resultado.ok) return resultado;
  revalidatePath("/calculadora");
  revalidatePath(`/calculadora/${id}`);
  revalidatePath(`/calculadora/${id}/imprimir`);
  return { ok: true, value: undefined };
}

export async function guardarCantidadSolicitada(
  id: number,
  codigo: string,
  tipo: "mpnc" | "empaque",
  cantidad: string,
): Promise<Resultado> {
  await exigirEdicion();
  const texto = cantidad.trim().replace(",", ".");
  const valor = texto === "" ? null : Number(texto);
  const resultado = await guardarSolicitado(getDb(), id, codigo.trim().toUpperCase(), tipo, valor);
  if (!resultado.ok) return resultado;
  revalidatePath(`/calculadora/${id}/resultado`);
  revalidatePath(`/calculadora/${id}/imprimir`);
  return { ok: true, value: undefined };
}

export async function guardarCantidadReceta(
  recetaId: string,
  codigo: string,
  tipo: "mpnc" | "empaque",
  cantidad: string,
): Promise<Resultado> {
  await exigirRango(["administrador"]);
  const texto = cantidad.trim().replace(",", ".");
  const valor = texto === "" ? null : Number(texto);
  const resultado = await guardarKgItem(getDb(), recetaId, codigo.trim().toUpperCase(), tipo, valor);
  if (!resultado.ok) return resultado;
  revalidatePath("/calculadora/recetas");
  return { ok: true, value: undefined };
}

export async function agregarIngrediente(form: FormData): Promise<Resultado> {
  await exigirRango(["administrador"]);
  const tipo = form.get("tipo") === "empaque" ? "empaque" : "mpnc";
  const kgTexto = String(form.get("kg") ?? "").trim().replace(",", ".");
  const kg = kgTexto === "" ? null : Number(kgTexto);
  const resultado = await agregarItemReceta(
    getDb(),
    String(form.get("receta") ?? ""),
    tipo,
    String(form.get("codigo") ?? ""),
    String(form.get("nombre") ?? ""),
    kg,
    String(form.get("unidad") ?? ""),
  );
  if (!resultado.ok) return resultado;
  revalidatePath("/calculadora/recetas");
  return { ok: true, value: undefined };
}

export async function importarRecetasCsv(texto: string): Promise<Resultado<{ n: number }>> {
  await exigirRango(["administrador"]);
  const parseado = parseCsvRecetas(texto);
  if (!parseado.ok) return parseado;
  const resultado = await importarCsvReceta(getDb(), parseado.filas);
  if (!resultado.ok) return resultado;
  revalidatePath("/calculadora/recetas");
  return { ok: true, value: { n: resultado.n } };
}
