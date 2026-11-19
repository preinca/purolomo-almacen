import { formatoFecha, formatoHora, formatoKg, textoVencimiento } from "@/lib/formato";
import type { EntradaPaleta } from "@/lib/entrada-paleta";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function TablaEntradas({
  entradas,
  mostrarUsuario = false,
  mostrarHora = false,
  vacio = "Todavía no hay entradas.",
}: {
  entradas: EntradaPaleta[];
  mostrarUsuario?: boolean;
  mostrarHora?: boolean;
  vacio?: string;
}) {
  if (entradas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {vacio}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          {mostrarHora ? <TableHead>Hora</TableHead> : null}
          <TableHead>Producto</TableHead>
          <TableHead>Lote</TableHead>
          <TableHead>Kilos</TableHead>
          <TableHead>Disponibles</TableHead>
          <TableHead>Vencimiento</TableHead>
          {mostrarUsuario ? <TableHead>Usuario</TableHead> : null}
          <TableHead>Token</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entradas.map((entrada) => (
          <TableRow key={entrada.token}>
            <TableCell>{formatoFecha(entrada.fecha)}</TableCell>
            {mostrarHora ? <TableCell>{formatoHora(entrada.creadoEn) || "—"}</TableCell> : null}
            <TableCell>
              <span className="font-medium">{entrada.producto}</span>
              <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{entrada.codigo}</span>
            </TableCell>
            <TableCell className="font-mono">{entrada.lote}</TableCell>
            <TableCell>{formatoKg(entrada.kg)}</TableCell>
            <TableCell>{entrada.kgDisponible === undefined ? "" : formatoKg(entrada.kgDisponible)}</TableCell>
            <TableCell>{textoVencimiento(entrada.vencimiento, entrada.vencimientoNoAplica)}</TableCell>
            {mostrarUsuario ? <TableCell>{entrada.usuario || "—"}</TableCell> : null}
            <TableCell className="font-mono text-xs">{entrada.token}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
