# Panel de inicio

## Propósito

Resume las entradas de paleta ya guardadas: cuántas paletas hay, cuántos kilos suman, el inventario por vencimiento y las doce últimas. No lista los TAG de cava (`lotes`). Esas existencias se consultan al pesar o en la ficha de un TAG.

## Quién lo usa

Cualquier rango con sesión. Es la ruta `/` y el ítem **Inicio** del menú.

## Pasos del usuario

1. Entra al almacén. El layout comprueba la sesión y pinta el marco (menú, nombre, rango, **Salir**).
2. Ve dos indicadores: **Paletas** (conteo de `entradas_paleta`) y **Kg recibidos** (suma de `kg`).
3. **Inventario** lista las paletas que todavía tienen kilos, primero la que vence antes. Una paleta con vencimiento que no aplica queda al final: no vence. La columna dice «No aplica».
4. Debajo, la tabla **Últimas entradas** muestra fecha, producto (el código va debajo del nombre), lote, kilos, vencimiento y token de las 12 filas más recientes. El usuario que registró la paleta se guarda, pero la tabla no lo muestra.
5. Si la base tarda o falla, la página de error ofrece **Reintentar**.

La tabla no enlaza a otra pantalla. Registrar una paleta nueva se hace en **Registrar entradas**.

## Rutas y páginas

| Ruta | Archivo |
| --- | --- |
| `/` | [`src/app/(panel)/page.tsx`](<../src/app/(panel)/page.tsx>) |
| Marco de todas las páginas del panel | [`src/app/(panel)/layout.tsx`](<../src/app/(panel)/layout.tsx>) |
| Error de carga | [`src/app/error.tsx`](../src/app/error.tsx) |

## Componentes

- [`PageFrame`](../src/components/page-frame.tsx) pone título y descripción.
- [`TablaEntradas`](../src/components/tabla-entradas.tsx) pinta la lista. Si no hay filas, dice que todavía no hay entradas.
- Tarjetas de [`src/components/ui/card.tsx`](../src/components/ui/card.tsx).
- Los números salen de [`formatoNumero`](../src/lib/formato.ts) en la zona `America/Caracas`.

## Datos que lee

No hay server action en esta página. El servidor llama a `resumirEntradas`, `listarInventarioPaletas` y `listarEntradas(db, 12)` de [`entrada-paleta.ts`](../src/lib/entrada-paleta.ts). Esas funciones crean la tabla `entradas_paleta` si todavía no existe (`asegurarEntradas`) y luego consultan. El inventario ordena por `vencimiento_no_aplica` y después por `vencimiento` ascendente.

Al confirmar una entrada, [`confirmarEntradaPaleta`](../src/app/entradas-paleta-acciones.ts) revalida `/` y `/entradas`.

## Tablas

`entradas_paleta`: `token` (clave), `codigo`, `producto`, `kg`, `lote`, `vencimiento` (nulo si no aplica), `vencimiento_no_aplica`, `fecha`, `usuario`, `creado_en`.

RLS activado, sin políticas. Ver [persistencia](persistencia.md).

## Código relacionado

- Página: [`src/app/(panel)/page.tsx`](<../src/app/(panel)/page.tsx>)
- Consultas: [`src/lib/entrada-paleta.ts`](../src/lib/entrada-paleta.ts)
- Tabla: [`src/components/tabla-entradas.tsx`](../src/components/tabla-entradas.tsx)
- Marco: [`src/components/shell.tsx`](../src/components/shell.tsx)
