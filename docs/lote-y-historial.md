# Ficha del TAG e historial

## Propósito

Muestra una paleta de cava: kilos recibidos, consumidos y disponibles, estado, observación, QR y la lista de movimientos. Desde aquí un recepcionista o un administrador puede dejar un aviso en el TAG. La misma ficha es el historial de esa paleta: no hay una página aparte de historial de entradas o de salidas.

## Quién lo usa

Cualquier sesión. `/lote` está en las rutas de consulta, así que recepcionista, pesador y consulta pueden abrirla. Cambiar la observación exige administrador o recepcionista.

## Pasos del usuario

1. Abre `/lote/<tag>`. Si `buscarLote` no encuentra la fila, responde la página de no encontrado («No está esa paleta») con un enlace a `/entradas`.
2. Ve el QR corto (`PUROLOMO MPC` y `TAG:<número>`), la fecha, la semana, el producto, el tipo del catálogo, los tres totales y el estado.
3. Si el estado es `LOGISTICA`, un aviso naranja dice que ya no se puede consumir. Si los disponibles son 0,001 kg o menos, un aviso rojo dice que se acabó la materia prima.
4. La observación guardada se muestra en un recuadro ámbar.
5. Quien puede avisar edita el texto (máximo 500 caracteres) y lo guarda. La acción no redirige: devuelve `ok` y el layout se revalida.
6. La tabla **Movimientos** lista, del más reciente al más antiguo, hora, tipo, producto de destino, línea, kilos y estado. Si no hay filas, dice «Sin movimientos.»
7. **Imprimir QR** abre el diálogo de impresión del navegador (`window.print()`).
8. **Despachar** enlaza a `/salidas?tag=<tag>`. La página de salidas no lee el parámetro `tag`: abre el selector de modo y no precarga ese TAG.
9. La ficha ofrece **Descargar QR** hacia `/qr/imagen/<tag>`. Esa ruta no tiene handler en `src/app`.

`QrEtiqueta` puede mostrar **Imprimir en Zebra** y **Eliminar** si se le pasan `puedeImprimir` y `puedeEliminar`. La ficha no los pasa, así que esos botones no salen. El botón de eliminar, si se montara, pediría confirmación y llamaría a `eliminarLoteFormulario` (solo administrador): borra movimientos y el lote, y redirige a `/qr?eliminado=<tag>`. Tampoco existe `src/app/**/qr/page.tsx`.

Los retiros (mini lotes) se leen con `retirosDeTag` y se listan bajo el QR: token, kilos, tipo, número de pesaje, línea y destino.

## Rutas que el código nombra y no tienen página

`refrescar` en las acciones revalida `/historial/entradas`, `/historial/salidas`, `/stock`, `/pesajes`, `/qr` y `/eliminar`. [`TablaLotes`](../src/components/tabla-lotes.tsx) enlazaría cada TAG a `/lote/<tag>` y filtraría por texto, estado y tipo, pero ninguna página la importa.

El historial que sí se puede abrir es esta ficha, más la tabla de movimientos.

## Componentes

- Página: [`src/app/(panel)/lote/[tag]/page.tsx`](<../src/app/(panel)/lote/[tag]/page.tsx>)
- QR y datos: [`QrEtiqueta`](../src/components/qr-etiqueta.tsx)
- Badge de estado: [`EstadoBadge`](../src/components/estado-badge.tsx)
- Observación: [`FormObservacion`](../src/components/form-observacion.tsx) con `guardarObservacionTagFormulario`
- Impresión del navegador: [`BotonImprimir`](../src/components/boton-imprimir.tsx)
- Eliminar (no montado en la ficha): [`BotonEliminarTag`](../src/components/boton-eliminar-tag.tsx)
- No encontrado: [`src/app/not-found.tsx`](../src/app/not-found.tsx)

## Server actions y consultas

| Pieza | Dónde |
| --- | --- |
| `guardarObservacionTagFormulario` | [`actions.ts`](../src/app/actions.ts) → `guardarObservacionLote` |
| `eliminarLoteFormulario` | [`actions.ts`](../src/app/actions.ts) → `eliminarLote`. Exige administrador y `confirmar=si`. |
| `buscarLote`, `movimientosDeTag`, `kgConsumidosDe`, `kgDisponiblesDe`, `kgRestantes`, `tagAgotado` | [`lotes.ts`](../src/lib/lotes.ts) |
| `retirosDeTag` | [`pesajes.ts`](../src/lib/pesajes.ts) |
| `productoPorCodigo` | [`mpc.ts`](../src/lib/mpc.ts) |
| `lineaPorId` | [`lineas.ts`](../src/lib/lineas.ts) |

`listarMovimientos` filtra por tipo (`recepcion`, `despacho`, `consumo`, `devolucion`, `transferencia`) pero ninguna página lo llama.

## Tablas

| Tabla | Uso |
| --- | --- |
| `lotes` | Cabecera del TAG. |
| `movimientos` | Historial. `movimientosDeTag` ordena por `id DESC`. |
| `minilotes` | Retiros mostrados en la ficha, unidos a `pesajes` para el número. |
| `pesajes` | Número de pesaje de cada mini lote. |

RLS activado, sin políticas. Ver [persistencia](persistencia.md).

## Código relacionado

- Página: [`src/app/(panel)/lote/[tag]/page.tsx`](<../src/app/(panel)/lote/[tag]/page.tsx>)
- Lotes y movimientos: [`src/lib/lotes.ts`](../src/lib/lotes.ts)
- Tabla reutilizable no montada: [`src/components/tabla-lotes.tsx`](../src/components/tabla-lotes.tsx)
- Pruebas de kilos y estados: [`src/lib/lotes.test.ts`](../src/lib/lotes.test.ts)
- Formato de fecha y kilos: [`src/lib/formato.ts`](../src/lib/formato.ts)
