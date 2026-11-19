# Impresión de etiquetas

## Propósito

Hay dos salidas de etiqueta. La ficha del TAG imprime con el diálogo del navegador. La cola Zebra guarda un trabajo ZPL para que un equipo de la oficina lo retire por HTTP y lo mande a la impresora.

## Impresión en el navegador

En `/lote/<tag>`, **Imprimir QR** llama a `window.print()`. El menú y el encabezado usan `print:hidden`, así que en el papel queda el contenido de la página, incluida la ficha [`QrEtiqueta`](../src/components/qr-etiqueta.tsx). No pasa por la base ni por la cola.

## Cola Zebra

### Quién la dispara

- `imprimirEtiquetasPendientes` encola todos los TAG de un proceso de recepción cerrado que aún tienen `impresa_en` vacío. Exige administrador o recepcionista. El aviso dice cuántas etiquetas se enviaron «a la impresora de la oficina». La página que mostraría ese botón no está montada; la acción sí. Ver [recepción de TAG](recepcion-tag.md).
- `imprimirEtiquetaZebra` encola un solo TAG y permite reimprimir. La usa [`BotonImprimirZebra`](../src/components/boton-imprimir-zebra.tsx). La ficha del lote no activa ese botón (`puedeImprimir` queda en falso).

Si el TAG ya está en cola (`impresa_en` empieza por `cola:`), no se encola otra vez.

### Qué se guarda

1. Se inserta `impresiones` con `estado = 'pendiente'`.
2. Cada TAG entra en `impresion_items` con `impresion_id`, `tag` y `orden`.
3. El lote queda con `impresa_en = 'cola:<id>'`.

`guardarEtiquetasPendientes` es el otro cierre del proceso: pone `impresa_en = 'guardada'` y no crea trabajo de impresión.

### API para el equipo de la oficina

[`GET` y `POST /api/impresion`](../src/app/api/impresion/route.ts). El proxy no pide sesión en esta ruta.

| Método | Efecto |
| --- | --- |
| `GET` | Toma el trabajo pendiente más antiguo. Lo pasa a `imprimiendo`, anota `tomada_en` y responde `{ id, zpl }`. Si no hay trabajo, `{ id: null, zpl: "" }`. Un trabajo en `imprimiendo` hace más de 2 minutos vuelve a `pendiente`. |
| `POST` | Cuerpo JSON `{ id, ok }`. Si `ok` es true, el trabajo pasa a `lista`, se anota `lista_en` y cada lote de ese trabajo recibe `impresa_en` con la hora. Si `ok` no es true, el trabajo vuelve a `pendiente`. |

La autorización es el encabezado `x-impresion-clave`, comparado en tiempo constante con la variable de entorno `IMPRESION_CLAVE`. Si la variable está vacía, o la longitud no coincide, responde 401 «No autorizado». Un `id` que no sea un entero positivo responde 400.

El ZPL lo arma `zplDeLotes` a partir de la etiqueta de cava (5,7 cm × 3,2 cm) y del texto corto `PUROLOMO MPC` / `TAG:<número>`.

## Otros formatos, sin ruta HTTP

Estas funciones generan el archivo, pero ninguna página las sirve:

| Formato | Código | Ruta que el componente cita y que no existe |
| --- | --- | --- |
| NLBL / XML para Zebra Designer | [`nlbl-etiqueta.ts`](../src/lib/nlbl-etiqueta.ts) y [`formato-qr.xml`](../src/lib/zebra/formato-qr.xml) | `/etiquetas/nlbl/<tag>` |
| PDF | [`pdf-etiqueta.ts`](../src/lib/pdf-etiqueta.ts) | `/etiquetas/pdf/<tag>` |
| PNG del QR | [`png-qr.ts`](../src/lib/png-qr.ts) | `/qr/imagen/<tag>` |

[`EtiquetaCava`](../src/components/etiqueta-cava.tsx) dibuja la misma etiqueta en HTML y documenta esas dos descargas. Ninguna página importa el componente.

## Tablas

| Tabla | Papel |
| --- | --- |
| `impresiones` | `pendiente`, `imprimiendo` o `lista`. Tiempos `creada_en`, `tomada_en`, `lista_en`. |
| `impresion_items` | TAG y orden dentro del trabajo. No declara clave primaria ni clave foránea en el esquema. |
| `lotes` | `impresa_en`: vacío (pendiente de enviar), `cola:<id>`, `guardada`, o la fecha ISO cuando la oficina confirmó. |
| `procesos_recepcion` | Solo se encolan en bloque los TAG de un proceso cerrado. |

RLS activado en `impresiones`, `impresion_items`, `lotes` y `procesos_recepcion`, sin políticas. Ver [persistencia](persistencia.md).

## Código relacionado

- API: [`src/app/api/impresion/route.ts`](../src/app/api/impresion/route.ts)
- Cola: [`src/lib/impresion.ts`](../src/lib/impresion.ts)
- ZPL: [`src/lib/zpl-etiqueta.ts`](../src/lib/zpl-etiqueta.ts)
- Medidas y líneas de la etiqueta: [`src/lib/etiqueta-cava.ts`](../src/lib/etiqueta-cava.ts)
- Plantilla Zebra: [`src/lib/zebra/formato-qr.xml`](../src/lib/zebra/formato-qr.xml)
- Botón del navegador: [`src/components/boton-imprimir.tsx`](../src/components/boton-imprimir.tsx)
- Botón de cola: [`src/components/boton-imprimir-zebra.tsx`](../src/components/boton-imprimir-zebra.tsx)
- Acciones: [`src/app/actions.ts`](../src/app/actions.ts) (`imprimirEtiquetaZebra`, `imprimirEtiquetasPendientes`, `guardarEtiquetasPendientes`)
- Pruebas: [`src/lib/zpl-etiqueta.test.ts`](../src/lib/zpl-etiqueta.test.ts), [`src/lib/etiqueta-cava.test.ts`](../src/lib/etiqueta-cava.test.ts)
- Variable de entorno (solo el nombre): `IMPRESION_CLAVE` en [`route.ts`](../src/app/api/impresion/route.ts). No está en [`.env.example`](../.env.example).
