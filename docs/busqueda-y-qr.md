# Búsqueda y lectura de QR

## Propósito

Localiza un TAG de cava o un consumo ya registrado a partir del número, de la cámara, de una foto o del texto que va dentro del QR. No hay una página «Buscar TAG»: el lector vive dentro de la salida para consumo y de la salida para logística.

## Pasos del usuario

1. En el pesaje o en logística, pulsa el escáner ([`EscanerSalida`](../src/components/escaner-salida.tsx)).
2. Puede usar la cámara, elegir una imagen o pegar el contenido.
3. Si el texto trae `TOKEN:ML…`, se trata como QR de consumo. `loteActualDesdeQr` busca el mini lote y arma los TAG de ese tipo en el pesaje. Si el token no existe, muestra el error.
4. Si no es consumo, `leerTextoQr` saca el TAG: campo `TAG:`, un renglón `TAG 123456`, o un texto que es solo el número (4 a 8 dígitos). Luego busca el lote. Si el QR no trae TAG, responde que no es de una paleta de este almacén.
5. También acepta un PDF de etiqueta: `tagDePdfEtiqueta` intenta leer el TAG del archivo.
6. En logística, además, el campo de texto llama a `loteActualDesdeTag` cuando hay 4 a 8 dígitos.
7. La ficha resultante trae fecha, semana, producto, tipo del catálogo, código, kilos (recibidos, despachados, consumidos y restantes), estado, destino, observación y mini lotes.

Hace falta una sesión. Si no hay cookie, las dos acciones responden «Inicia sesión.» No exigen un rango concreto: un recepcionista podría invocarlas, aunque no llega a la página `/salidas`.

La entrada de paleta y la dosificación usan otro lector, [`EscanerToken`](../src/components/escaner-token.tsx), que solo entiende tokens `PLT-…`. Pide la cámara trasera principal (1920×1080, enfoque continuo) y deja cambiar de cámara. La ultra gran angular no enfoca el QR de cerca. Ese flujo está en [entradas de paleta](entradas-paleta.md).

## Textos de QR que genera la aplicación

| Función | Prefijo | Cuándo |
| --- | --- | --- |
| `textoQrDeEtiqueta` | `PUROLOMO MPC` y `TAG:` | Etiqueta impresa y QR de la ficha. Es el que el escáner lee más fácil. |
| `textoQr` | Ficha larga: fecha, tipo, kilos, estado, observación y una línea `Mini:` por retiro | QR de pantalla con trazabilidad. |
| `textoQrMiniLote` | `PUROLOMO CONSUMO` y `TOKEN:` | Identifica un retiro. `leerConsumoQr` acepta `ML` más 4 alfanuméricos o 6 dígitos. |
| `textoQrPesaje` | `PUROLOMO PESAJE` | Resumen del pesaje: número, línea, total y cada retiro. |
| `partirToken` | `PLT-codigo-lote-secuencia-id` | Paleta del otro dashboard, no un TAG de cava. |

`loteActualDesdeQr` mira primero el consumo y después el TAG.

## Rutas de imagen que no están

La ficha, la logística y el pesaje enlazan a:

- `/qr/imagen/<tag>` para descargar un PNG.
- `/qr/pesaje/<id>` para el QR del pesaje.

No hay `route.ts` ni `page.tsx` bajo `src/app` para `/qr`. [`png-qr.ts`](../src/lib/png-qr.ts) sabe generar el PNG, y [`fichaQrPesaje`](../src/lib/pesajes.ts) arma los datos del pesaje, pero ninguna ruta los publica.

[`etiqueta-cava.tsx`](../src/components/etiqueta-cava.tsx) construye `/etiquetas/nlbl/<tag>` y `/etiquetas/pdf/<tag>`. Esas rutas tampoco tienen handler. El componente `EtiquetaCava` no lo importa ninguna página.

## Tablas

La búsqueda no escribe.

| Tabla | Lectura |
| --- | --- |
| `lotes` | `buscarLote` por TAG. |
| `minilotes` | `buscarMiniLote` por token y `retirosDeTag`. |
| `pesajes` | Número, destino y línea del mini lote; `tagsDelTipo` para los TAG del mismo tipo en ese pesaje. |

RLS activado, sin políticas. Ver [persistencia](persistencia.md).

## Código relacionado

- Escáner de salidas: [`src/components/escaner-salida.tsx`](../src/components/escaner-salida.tsx)
- Escáner de token de paleta: [`src/components/escaner-token.tsx`](../src/components/escaner-token.tsx)
- Decodificar imagen: [`src/components/decodificar-imagen-qr.ts`](../src/components/decodificar-imagen-qr.ts)
- Acciones de lectura: [`src/app/actions.ts`](../src/app/actions.ts) (`loteActualDesdeTag`, `loteActualDesdeQr`)
- Textos y SVG: [`src/lib/qr.ts`](../src/lib/qr.ts)
- TAG dentro de un PDF: [`src/lib/pdf-etiqueta.ts`](../src/lib/pdf-etiqueta.ts)
- PNG: [`src/lib/png-qr.ts`](../src/lib/png-qr.ts)
- Ficha en pantalla: [`src/components/qr-etiqueta.tsx`](../src/components/qr-etiqueta.tsx)
