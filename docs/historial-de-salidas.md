# Historial de salidas

## Propósito

Lista consumos y despachos por TAG: fecha, tipo, producto de destino, línea, kilos y nota. El título de la página es **Historial de salidas**.

La lógica es la de producción: se leen movimientos `despacho` y `consumo`, se juntan, se ordenan por `id` descendente y se dejan 200. Los traslados a logística no entran; se guardan como movimiento `transferencia`.

En producción esta ruta no está en el menú. Aquí sí, para cualquier rango con sesión.

No hay filtro, paginación por páginas ni exportación. Producción tampoco los tiene en este flujo. La planilla con filtro por día y el PDF, en producción, son **Registro de pesajes**, que en almacén no está en el menú.

## Quién lo usa

Cualquier rango con sesión. `/historial` está en las rutas de consulta. El menú lo muestra a todos.

Registrar la salida sigue en **Registrar salidas**: el pesador y el administrador pesan el consumo; el traslado a logística lo hace solo el administrador.

## Pasos

1. El usuario abre **Historial de salidas** o entra a `/historial/salidas`.
2. La página pide hasta 200 movimientos `despacho` y hasta 200 `consumo`.
3. Junta las dos listas, las ordena por `id` descendente y se queda con 200.
4. La tabla muestra fecha, tipo, TAG (enlace a `/lote/[tag]`), destino, línea, kilos y nota.
5. Si no hay filas, dice «Todavía no hay salidas.»

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/historial/salidas` | Despachos y consumos recientes |

## Componentes

- `PageFrame`
- `Card`
- `Table`

La línea se traduce con `lineaPorId`: `1` es Línea 1 y `2` es Línea 2. Un consumo sin línea muestra «—».

## Server actions y API routes

Ninguna en esta página. Las salidas que ya existen (`registrarDespacho`, `registrarConsumo` y el pesaje) revalidan `/historial/salidas` desde `refrescar` en `src/app/actions.ts`.

## Tablas y consultas

Tabla `movimientos`. RLS activado, sin políticas. La app usa la conexión directa.

```sql
SELECT * FROM movimientos
WHERE tipo = ?
ORDER BY fecha DESC, id DESC
LIMIT 200
```

Se ejecuta dos veces, con `despacho` y con `consumo`. No une con `lotes`: el producto que se ve es `movimientos.destino` (el uso, por ejemplo ALIBAL 1 K), no el nombre de la materia prima del TAG.

La salida para consumo del pesaje se guarda como `despacho` y, además, como mini lote. El historial muestra el movimiento, no la planilla del pesaje. `registrarConsumo` escribe un movimiento `consumo`; la pantalla de salidas de hoy no lo usa para el pesaje, pero si hay filas de ese tipo también salen.

No se guarda el usuario en `movimientos`. Producción tampoco lo guarda, así que no se agregó columna.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`. Si no hay ninguna, la app usa la base local de `data/almacen`.
- `SESION_SECRETO`.

## Archivos relacionados

- [src/app/(panel)/historial/salidas/page.tsx](<../src/app/(panel)/historial/salidas/page.tsx>)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/table.tsx](../src/components/ui/table.tsx)
- [src/lib/lotes.ts](../src/lib/lotes.ts)
- [src/lib/lineas.ts](../src/lib/lineas.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/lib/pesajes.ts](../src/lib/pesajes.ts)
- [src/app/actions.ts](../src/app/actions.ts)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
