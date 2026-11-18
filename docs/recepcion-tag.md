# Recepción de TAG en cava

## Propósito

Da de alta una paleta de materia prima cárnica como lote de cava: un TAG de 6 dígitos, un producto del catálogo MPC, los kilos recibidos y, si se indica, la semana. El lote queda en estado `RECIBIDO` con kilos despachados y consumidos en cero, y nace un movimiento `recepcion`.

Las salidas para consumo y para logística leen estos lotes, no las filas de `entradas_paleta`. Sin un TAG en `lotes` no hay nada que pesar.

## Qué pantalla hay hoy

La página `/entradas` muestra el alta por token de paleta ([entradas de paleta](entradas-paleta.md)). No importa [`EntradaForm`](../src/components/entrada-form.tsx).

El formulario y las acciones de este flujo siguen en el código. Si se invocan, redirigen a `/entradas` con `aviso` y, a veces, `tono=ok` o `tono=error`. La página actual de entradas no lee esos parámetros: el aviso de la recepción de TAG no se pintaría ahí.

## Pasos que implementa el código

1. Un administrador o un recepcionista inicia el proceso (`iniciarProcesoRecepcion`). Solo puede haber un proceso con estado `abierta`.
2. En el formulario se eligen fecha, TAG de 6 dígitos, producto del catálogo, kilos y una observación opcional (máximo 500 caracteres). La semana, si se escribe, es un entero del 1 al 53; si se omite, se calcula de la fecha.
3. Al teclear un TAG de 6 dígitos, `revisarTagEntrada` avisa si ya existe.
4. `crearRecepcion` valida, exige un proceso abierto, inserta el lote y el movimiento, y asigna `proceso_id`.
5. Se puede quitar una etiqueta del proceso abierto (`eliminarEtiquetaEnCurso`) si sigue en `RECIBIDO`, no tiene kilos movidos, no tiene mini lotes y no se envió a imprimir.
6. **Reiniciar la carga** borra los lotes y movimientos de ese proceso, con la misma condición. Pide la casilla `confirmar=si`.
7. **Terminar el proceso** pasa la fila a `cerrada` y anota `cerrada_en`. No imprime solo: deja las etiquetas pendientes (`impresa_en` vacío).
8. Con el proceso cerrado se puede guardar sin imprimir (`impresa_en = 'guardada'`), borrar etiquetas todavía no enviadas, o encolarlas en la impresora de oficina. Esa cola está en [impresión](impresion.md).

No se puede reiniciar ni borrar un TAG que ya se usó (kilos despachados o consumidos, estado distinto de `RECIBIDO`, o filas en `minilotes`).

## Catálogo

Los productos válidos están en [`PRODUCTOS_MPC`](../src/lib/mpc.ts) (código, nombre, tipo corto como `GL` o `CH`, y descripción). Al abrir la base local, [`asegurarCatalogo`](../src/lib/seed.ts) vuelca esa lista a la tabla `productos`. El script de migración hace lo mismo en Supabase.

El estado inicial del lote es `RECIBIDO`. El resto de estados posibles en el código son `TRANSFIRIO`, `CONSUMIDOS`, `DEVUELTO` y `LOGISTICA`.

## Server actions

Todas están en [`actions.ts`](../src/app/actions.ts) y exigen `administrador` o `recepcionista`.

| Acción | Efecto |
| --- | --- |
| `revisarTagEntrada` | Devuelve un aviso si el TAG ya está en `lotes`. |
| `crearRecepcion` | Valida, inserta y asigna el proceso abierto. |
| `iniciarProcesoRecepcion` | Crea `procesos_recepcion` en `abierta`. |
| `reiniciarProcesoRecepcion` | Borra la carga del proceso abierto, con confirmación. |
| `terminarProcesoRecepcion` | Cierra el proceso. |
| `eliminarEtiquetaEnCurso` | Borra un TAG del proceso abierto. |
| `eliminarEtiquetasPorImprimir` | Borra una selección o todas las pendientes de un proceso cerrado. Borrar todas pide confirmación. |
| `guardarEtiquetasPendientes` | Marca `impresa_en = 'guardada'` sin encolar. |
| `imprimirEtiquetasPendientes` | Encola el ZPL del proceso. |

La inserción está en `validarRecepcion` e `insertarRecepcion` de [`lotes.ts`](../src/lib/lotes.ts). El ciclo del proceso está en [`proceso-recepcion.ts`](../src/lib/proceso-recepcion.ts).

Hay otra acción, `validarTransferencia`, que llama a `transferirLote`: solo si el estado es `RECIBIDO`, lo pasa a `TRANSFIRIO` y escribe un movimiento `transferencia` de 0 kg. Ningún componente la importa.

## Tablas

| Tabla | Uso |
| --- | --- |
| `productos` | Catálogo MPC. Clave `codigo`. |
| `lotes` | Una fila por TAG. Kilos, estado, observación, destino, `proceso_id`, `impresa_en`. |
| `movimientos` | Una fila `recepcion` por alta. Tipos permitidos: `recepcion`, `despacho`, `consumo`, `devolucion`, `transferencia`. |
| `procesos_recepcion` | `abierta` o `cerrada`, con `iniciada_en` y `cerrada_en`. |

RLS activado en las cuatro, sin políticas. Ver [persistencia](persistencia.md).

## Código relacionado

- Formulario (no montado en una página): [`src/components/entrada-form.tsx`](../src/components/entrada-form.tsx)
- Acciones: [`src/app/actions.ts`](../src/app/actions.ts)
- Lotes: [`src/lib/lotes.ts`](../src/lib/lotes.ts)
- Proceso: [`src/lib/proceso-recepcion.ts`](../src/lib/proceso-recepcion.ts)
- Catálogo: [`src/lib/mpc.ts`](../src/lib/mpc.ts)
- Semilla del catálogo: [`src/lib/seed.ts`](../src/lib/seed.ts)
- Pruebas: [`src/lib/lotes.test.ts`](../src/lib/lotes.test.ts), [`src/lib/proceso-recepcion.test.ts`](../src/lib/proceso-recepcion.test.ts)
