# Inventario y stock de cava

## Propósito

Lleva los kilos de cada TAG de materia prima: lo recibido, lo despachado en pesajes y lo consumido por la acción suelta. El disponible es la diferencia. Un TAG en logística sale del stock que se puede pesar, aunque sus kilos numéricos sigan en la fila.

La pantalla de inicio no es este inventario de cava. El inicio suma paletas de `entradas_paleta` y, en **Inventario**, lista las que todavía tienen kilos ordenadas por vencimiento: primero la que vence antes y al final las que tienen «No aplica» ([panel](panel.md)). El stock de cava vive en `lotes` y no usa esa fecha.

## Cómo se calcula

| Concepto | Regla |
| --- | --- |
| Kg restantes / disponibles | `kg_recibidos - kg_despachados - kg_consumidos`, redondeado a 3 decimales. |
| Kg ya salidos | `kg_despachados + kg_consumidos`. |
| Agotado | Disponibles ≤ 0,001 kg. |
| Fuera de cava para pesar | `estado = 'LOGISTICA'`. `existenciasDeTipos` los excluye, igual que los de disponible ≤ 0. |

Al despachar desde un pesaje sube `kg_despachados` y el estado se deja en `RECIBIDO` aunque el saldo quede en cero. `registrarConsumo` (no usada por la pantalla de salidas) sube `kg_consumidos` y, si el saldo queda en cero, pone estado `CONSUMIDOS`.

El destino del lote acumula los productos en los que se usó, separados por ` · `.

## Dónde lo ve el usuario

No hay página `/stock`, `/inventario` ni `/pesajes`, aunque el proxy las autoriza para consulta y las acciones las revalidan.

Lo que sí está en pantalla:

1. Al pesar, `existenciasDeTipos` busca lotes cuyo `codigo` corresponde a los tipos de la receta. La ficha del TAG escaneado lista otros TAG del mismo tipo que todavía tienen kilos.
2. La ficha `/lote/<tag>` muestra recibidos, consumidos (despachados + consumidos), disponibles y el historial. Ver [ficha del TAG](lote-y-historial.md).
3. [`TablaLotes`](../src/components/tabla-lotes.tsx) sabe filtrar por texto, estado y tipo y enlazar a la ficha, pero ninguna página la renderiza.
4. `listarLotes` busca por estado y por texto en TAG, producto, código, semana o destino (tope 500). `resumir` cuenta paletas y suma los tres campos de kilos. Ninguna página llama a esas dos funciones.

## Consultas de apoyo

| Función | Archivo | Para qué |
| --- | --- | --- |
| `existenciasDeTipos` | [`pesajes.ts`](../src/lib/pesajes.ts) | TAG con saldo, agrupables por tipo MPC, sin logística. |
| `faltantesDeReceta` | [`pesajes.ts`](../src/lib/pesajes.ts) | Compara la fórmula con la suma disponible por tipo. |
| `kgRestantes`, `kgDisponiblesDe`, `tagAgotado` | [`lotes.ts`](../src/lib/lotes.ts) | Cifras de la ficha y de las validaciones. |
| `productoPorTipo` / `productoPorCodigo` | [`mpc.ts`](../src/lib/mpc.ts) | Traduce el tipo de la receta al código guardado en el lote. |
| `bloquearLote` (`SELECT … FOR UPDATE`) | [`lotes.ts`](../src/lib/lotes.ts) | Una salida no pisa a otra. |

## Tablas

| Tabla | Papel en el stock |
| --- | --- |
| `lotes` | Saldo por TAG. Índices por fecha, estado, código y `creado_en`. |
| `movimientos` | Cada cambio de kilos. Índices por TAG y por tipo+fecha. |
| `minilotes` | Detalle del despacho que ya salió hacia un pesaje. |
| `productos` | Código y tipo con los que se agrupa la existencia. |

Checks del esquema: los tres campos de kilos de `lotes` son ≥ 0. El kilo de un movimiento es ≥ 0. El kilo de un mini lote es > 0.

RLS activado, sin políticas. Ver [persistencia](persistencia.md).

## Código relacionado

- Cálculo y listados: [`src/lib/lotes.ts`](../src/lib/lotes.ts)
- Existencias durante el pesaje: [`src/lib/pesajes.ts`](../src/lib/pesajes.ts)
- Catálogo de tipos: [`src/lib/mpc.ts`](../src/lib/mpc.ts)
- Tabla no montada: [`src/components/tabla-lotes.tsx`](../src/components/tabla-lotes.tsx)
- Uso en la salida: [`src/components/salida-alibal.tsx`](../src/components/salida-alibal.tsx)
- Rutas de consulta nombradas en el proxy: [`src/lib/acceso.ts`](../src/lib/acceso.ts)
- Pruebas: [`src/lib/lotes.test.ts`](../src/lib/lotes.test.ts), [`src/lib/pesajes.test.ts`](../src/lib/pesajes.test.ts)
