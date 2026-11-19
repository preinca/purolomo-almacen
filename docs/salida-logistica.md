# Salida para logística

## Propósito

Saca de la cava el saldo de un TAG. El lote pasa a estado `LOGISTICA`, guarda la observación y ya no se puede consumir en un pesaje. El QR de pantalla incluye el aviso «Trasladado a logística. Este TAG ya no se puede consumir.»

No descuenta `kg_despachados` ni `kg_consumidos`. El movimiento registra los kilos que quedaban, con tipo `transferencia`.

## Quién lo usa

Solo el administrador. La tarjeta **Salida para logística** no se pinta para el pesador. La acción `trasladarLogisticaFormulario` llama a `exigirAdmin`. Si un pesador abre `?modo=logistica`, la página no entra en ese modo: vuelve a mostrar el selector, solo con la tarjeta de consumo.

## Pasos del usuario

1. En **Registrar salidas**, el administrador elige **Salida para logística** (`/salidas?modo=logistica`).
2. Escribe el TAG (4 a 8 dígitos) o lo escanea. A los 300 ms, `loteActualDesdeTag` trae la ficha: tipo, kilos disponibles y estado.
3. Si el TAG no existe, o el número no tiene entre 4 y 8 dígitos, no hay ficha.
4. Si el estado ya es `LOGISTICA`, el formulario avisa y no ofrece el traslado.
5. Escribe una observación obligatoria (máximo 500 caracteres). Se concatena a la observación anterior con ` · `.
6. Confirma. La fecha del movimiento es hoy (`fechaHoy`).
7. Si no quedan kilos (disponibles ≤ 0,001), la acción rechaza el traslado.
8. Si sale bien, redirige a `/salidas?modo=logistica&trasladado=<tag>` y muestra el enlace «Descargar el QR actualizado» hacia `/qr/imagen/<tag>`. Esa ruta no tiene archivo de página en este repositorio.

El destino del lote suma el tramo `LOGISTICA` si todavía no estaba. El movimiento lleva nota `Trasladado a logística.` más la observación, estado `LOGISTICA` y destino `LOGISTICA`.

## Rutas y componentes

| Pieza | Dónde |
| --- | --- |
| Página | [`src/app/(panel)/salidas/page.tsx`](<../src/app/(panel)/salidas/page.tsx>) |
| Formulario | [`SalidaLogistica`](../src/components/salida-logistica.tsx) |
| Escáner | [`EscanerSalida`](../src/components/escaner-salida.tsx) |
| Acción | `trasladarLogisticaFormulario` en [`actions.ts`](../src/app/actions.ts) |
| Regla | `trasladarALogistica` en [`lotes.ts`](../src/lib/lotes.ts) |

La lectura del TAG revalida la ficha en [`lote/[tag]`](<../src/app/(panel)/lote/[tag]/page.tsx>): allí el estado naranja repite que ya no se puede consumir. El pesaje rechaza el mismo TAG en `registrarDespacho`.

## Tablas

| Tabla | Cambio |
| --- | --- |
| `lotes` | `estado = 'LOGISTICA'`, `observaciones` y `destino` actualizados. Los kilos numéricos no cambian. |
| `movimientos` | Inserta `tipo = 'transferencia'`, `kg` = saldo restante, `estado = 'LOGISTICA'`. |

RLS activado, sin políticas. Ver [persistencia](persistencia.md). El lote se bloquea con `FOR UPDATE`.

## Código relacionado

- Página: [`src/app/(panel)/salidas/page.tsx`](<../src/app/(panel)/salidas/page.tsx>)
- Formulario: [`src/components/salida-logistica.tsx`](../src/components/salida-logistica.tsx)
- Dominio: [`src/lib/lotes.ts`](../src/lib/lotes.ts)
- Acción: [`src/app/actions.ts`](../src/app/actions.ts)
- Aviso en el texto del QR: [`src/lib/qr.ts`](../src/lib/qr.ts)
- Ficha: [`src/app/(panel)/lote/[tag]/page.tsx`](<../src/app/(panel)/lote/[tag]/page.tsx>)
