/** El Excel imprime un solo carmín. 01182 es el mismo líquido que 01004. */
export const ALIAS_MPNC: Record<string, string> = {
  MPCM01182: "MPCM01004",
};

export function codigoHoja(codigo: string) {
  const limpio = codigo.trim().toUpperCase();
  return ALIAS_MPNC[limpio] ?? limpio;
}

export const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"] as const;
export type Dia = (typeof DIAS)[number];

export const NOMBRE_DIA: Record<Dia, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
};

export type BatchesDia = Record<Dia, number>;

export type FilaPlan = {
  orden: number;
  planta: string;
  nombre: string;
  recetaId: string;
};

export type ItemMpnc = {
  codigo: string;
  nombre: string;
  kgPorBatch: number;
};

export type ItemEmpaque = {
  codigo: string;
  nombre: string;
  unidad: string;
  cantidadPorBatch: number | null;
  cantidadObservada: number | null;
  nota: string;
};

export type RecetaCalc = {
  id: string;
  nombre: string;
  planta: string;
  items: ItemMpnc[];
  empaque: ItemEmpaque[];
};

export type TotalCodigo = {
  codigo: string;
  nombre: string;
  unidad: string;
  tipo: "mpnc" | "empaque";
  cantidad: number | null;
  porPlanta: Record<string, number>;
};

export function sumaBatches(b: BatchesDia) {
  return DIAS.reduce((suma, dia) => suma + numero(b[dia]), 0);
}

export function batchesVacios(): BatchesDia {
  return { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 };
}

/** Kilos de la semana = batches de la fila × kg por batch, sumados por código. */
export function calcularMpnc(filas: FilaPlan[], recetas: RecetaCalc[], porFila: Map<number, BatchesDia>): TotalCodigo[] {
  const receta = new Map(recetas.map((item) => [item.id, item]));
  const totales = new Map<string, TotalCodigo>();

  for (const fila of filas) {
    const batches = sumaBatches(porFila.get(fila.orden) ?? batchesVacios());
    if (!(batches > 0)) continue;
    const formula = receta.get(fila.recetaId);
    if (!formula) continue;
    for (const item of formula.items) {
      const codigo = codigoHoja(item.codigo);
      const kg = batches * item.kgPorBatch;
      const previo = totales.get(codigo);
      if (!previo) {
        totales.set(codigo, {
          codigo,
          nombre: item.nombre,
          unidad: "kg",
          tipo: "mpnc",
          cantidad: kg,
          porPlanta: { [fila.planta]: kg },
        });
        continue;
      }
      if (item.codigo.trim().toUpperCase() === codigo) previo.nombre = item.nombre;
      previo.cantidad = (previo.cantidad ?? 0) + kg;
      previo.porPlanta[fila.planta] = (previo.porPlanta[fila.planta] ?? 0) + kg;
    }
  }

  for (const total of totales.values()) {
    total.cantidad = total.cantidad === null ? null : redondear(total.cantidad);
    for (const planta of Object.keys(total.porPlanta)) {
      total.porPlanta[planta] = redondear(total.porPlanta[planta] ?? 0);
    }
  }
  return [...totales.values()];
}

/**
 * Empaque: solo multiplica si la receta tiene cantidad por batch.
 * Si está vacía, el material igual aparece para anotarlo a mano y la cantidad calculada queda en blanco.
 */
export function calcularEmpaque(filas: FilaPlan[], recetas: RecetaCalc[], porFila: Map<number, BatchesDia>): TotalCodigo[] {
  const batchesReceta = new Map<string, number>();
  const plantaReceta = new Map<string, string>();
  for (const fila of filas) {
    const suma = sumaBatches(porFila.get(fila.orden) ?? batchesVacios());
    batchesReceta.set(fila.recetaId, (batchesReceta.get(fila.recetaId) ?? 0) + suma);
    if (!plantaReceta.has(fila.recetaId)) plantaReceta.set(fila.recetaId, fila.planta);
  }

  const totales = new Map<string, TotalCodigo>();
  for (const formula of recetas) {
    const batches = batchesReceta.get(formula.id) ?? 0;
    const planta = plantaReceta.get(formula.id) ?? formula.planta;
    for (const item of formula.empaque) {
      const aporta = item.cantidadPorBatch === null ? null : batches * item.cantidadPorBatch;
      const previo = totales.get(item.codigo);
      if (!previo) {
        totales.set(item.codigo, {
          codigo: item.codigo,
          nombre: item.nombre,
          unidad: item.unidad,
          tipo: "empaque",
          cantidad: aporta === null ? null : redondear(aporta),
          porPlanta: aporta === null ? {} : { [planta]: redondear(aporta) },
        });
        continue;
      }
      if (aporta === null) continue;
      previo.cantidad = redondear((previo.cantidad ?? 0) + aporta);
      previo.porPlanta[planta] = redondear((previo.porPlanta[planta] ?? 0) + aporta);
    }
  }
  return [...totales.values()];
}

export type LineaCsv = { receta: string; codigo: string; ingrediente: string; kgPorBatch: number };

export function parseCsvRecetas(texto: string): { ok: true; filas: LineaCsv[] } | { ok: false; error: string } {
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
  if (lineas.length === 0) return { ok: false, error: "El archivo está vacío." };
  const sep = lineas[0]?.includes(";") ? ";" : ",";
  const filas: LineaCsv[] = [];
  for (const [indice, linea] of lineas.entries()) {
    const celdas = linea.split(sep).map((celda) => celda.trim().replace(/^"|"$/g, ""));
    if (indice === 0 && celdas[0]?.toLowerCase() === "receta") continue;
    if (celdas.length < 4) return { ok: false, error: `La línea ${indice + 1} no tiene las 4 columnas.` };
    let kgTexto = celdas[celdas.length - 1] ?? "";
    let ingrediente = celdas.slice(2, -1).join(sep);
    if (sep === "," && celdas.length >= 5 && /^\d+$/.test(celdas[celdas.length - 2] ?? "") && /^\d+$/.test(kgTexto)) {
      kgTexto = `${celdas[celdas.length - 2]}.${kgTexto}`;
      ingrediente = celdas.slice(2, -2).join(sep);
    }
    const kg = Number(kgTexto.replace(",", "."));
    if (!celdas[0] || !celdas[1] || !ingrediente || !Number.isFinite(kg) || kg < 0) {
      return { ok: false, error: `La línea ${indice + 1} no se pudo leer.` };
    }
    filas.push({
      receta: celdas[0],
      codigo: celdas[1].toUpperCase(),
      ingrediente,
      kgPorBatch: kg,
    });
  }
  if (filas.length === 0) return { ok: false, error: "No hay filas para importar." };
  return { ok: true, filas };
}

function numero(valor: number) {
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

function redondear(valor: number) {
  return Math.round((valor + Number.EPSILON) * 1000) / 1000;
}
