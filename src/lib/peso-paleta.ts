export function pesoTotalPaleta(pesoUnitario: number, cantidad: number) {
  if (!Number.isFinite(pesoUnitario) || !Number.isFinite(cantidad)) return null;
  if (pesoUnitario <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) return null;
  return Math.round(pesoUnitario * cantidad * 1000) / 1000;
}
