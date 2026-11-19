# Historial de salidas

## Propósito

Lista las salidas del almacén. La salida de hoy es la **Dosificación**: cada fila trae token, código, descripción, núcleo, peso unitario, cantidad, peso total y si está anulada. Debajo quedan los despachos y consumos de TAG que no pertenecen a una dosificación.

El título de la página es **Historial de salidas**. En el menú, registrar una salida se llama **Dosificación**.

Los traslados a logística no entran; se guardan como movimiento `transferencia`. El consumo que crea una dosificación tampoco se repite en la segunda tabla: ya está en la primera, con `dosificacion_id`.

En producción el historial solo lee movimientos y no está en el menú. Aquí sí, para cualquier rango con sesión.

No hay filtro, paginación por páginas ni exportación. El tope es de 200 dosificaciones y 200 movimientos.

## Quién lo usa

Cualquier rango con sesión. `/historial` está en las rutas de consulta. El menú lo muestra a todos.

Registrar y anular una dosificación sigue en **Dosificación** (`/salidas`) y lo hacen el pesador y el administrador.

## Pasos

1. El usuario abre **Historial de salidas** o entra a `/historial/salidas`.
2. `listarDosificaciones` trae hasta 200 filas de `dosificaciones`, de la más reciente a la más antigua. La columna Destino sale de `destino` (`purolomo`, `makilas_san_pablo`, `makilas_turmero`).
3. `listarHistorialSalidas` junta hasta 200 despachos y hasta 200 consumos con `dosificacion_id` vacío, los ordena por `id` descendente y se queda con 200.
4. La primera tabla muestra fecha y hora en Caracas, token, código, descripción, núcleo, peso unitario, cantidad, peso total y anulada (`Sí` o `No`).
5. La segunda tabla muestra fecha, tipo, TAG (enlace a `/lote/[tag]`), destino, línea, kilos y nota.
6. Si no hay ninguna fila, dice «Todavía no hay salidas.»

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/historial/salidas` | Dosificaciones y salidas de TAG recientes |

## Componentes

- `PageFrame`
- `Card`
- `Table`

La línea se traduce con `lineaPorId`: `1` es Línea 1 y `2` es Línea 2. Un consumo sin línea muestra «—».

## Server actions y API routes

Ninguna en esta página. `registrarDosificacion` y `anularRegistroDosificacion` revalidan `/historial/salidas`. Los despachos y consumos de TAG también, desde `refrescar` en `src/app/actions.ts`.

## Tablas y consultas

Tablas `dosificaciones` y `movimientos`. RLS activado, sin políticas. La app usa la conexión directa. No hace falta un SQL nuevo: `dosificaciones` y `movimientos.dosificacion_id` ya están en `supabase/esquema.sql` y en `supabase/migraciones/2026-11-19-dosificacion.sql` y `supabase/migraciones/2026-11-19-dosificacion-stock.sql`.

```sql
SELECT * FROM dosificaciones
ORDER BY creado_en DESC, id DESC
LIMIT 200
```

```sql
SELECT * FROM movimientos
WHERE tipo = 'despacho'
ORDER BY fecha DESC, id DESC
LIMIT 200
```

```sql
SELECT * FROM movimientos
WHERE tipo = 'consumo' AND dosificacion_id IS NULL
ORDER BY fecha DESC, id DESC
LIMIT 200
```

En la segunda tabla el producto es `movimientos.destino`, no el nombre de la materia prima del TAG. Anular una dosificación deja la fila con `anulada = 1` y un movimiento `devolucion`; ese movimiento no se lista aquí.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`. Si no hay ninguna, la app usa la base local de `data/almacen`.
- `SESION_SECRETO`.

## Archivos relacionados

- [src/app/(panel)/historial/salidas/page.tsx](<../src/app/(panel)/historial/salidas/page.tsx>)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/lib/dosificacion.ts](../src/lib/dosificacion.ts)
- [src/app/dosificacion-acciones.ts](../src/app/dosificacion-acciones.ts)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/lineas.ts](../src/lib/lineas.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/app/actions.ts](../src/app/actions.ts)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
