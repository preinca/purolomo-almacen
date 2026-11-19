# Entradas de paleta por QR

## Propósito

Registra la llegada de una paleta cuyo QR solo trae un token (`PLT-código-lote-secuencia-id`). El nombre, los kilos, el lote y el vencimiento no se teclean: se piden al otro dashboard y se contrastan con el token. Cada token se guarda una sola vez.

Esta es la pantalla que hoy está montada en **Registrar entradas**. El alta manual de un TAG de cava es otro flujo, descrito en [recepción de TAG](recepcion-tag.md), y no se muestra en esta página.

## Quién lo usa

Administrador y recepcionista. Consulta y pesador no pasan el proxy en `/entradas`.

## Pasos del usuario

1. Abre **Registrar entradas** (`/entradas`).
2. Escanea el QR con la cámara, sube una foto del QR, o escribe el token y pulsa **Consultar**.
3. La aplicación parte el token. Si el formato no es `PLT-…` con cuatro tramos, muestra el error y no consulta.
4. Si ese token ya está en `entradas_paleta`, muestra la ficha guardada y avisa que no se creará otra entrada. No hay botón de registrar.
5. Si no está, consulta el otro dashboard. En local, ese dashboard es el archivo `data/dashboard-remoto.json`. Si el archivo no existe, se crea con una paleta de prueba. Si el archivo dice que no responde, o no trae ese token, la entrada no se registra.
6. Cruza código, lote y token. Exige nombre, kilos mayores que 0 y una fecha de vencimiento válida (`AAAA-MM-DD`). Si algo no coincide, muestra el error.
7. Si todo cuadra, la ficha pide **Registrar entrada**.
8. Al confirmar, vuelve a consultar, marca la paleta como recibida en el otro dashboard y solo entonces inserta la fila local. Si el aviso al otro dashboard falla, no se guarda nada. Si el insert local falla después de avisar, intenta liberar la marca de recibida.
9. La fecha de la entrada es el día de hoy en `America/Caracas`. El usuario guardado es el de la sesión.
10. Un aviso verde confirma producto y kilos, el formulario se limpia y la tabla de abajo se refresca.

La tabla **Entradas registradas** lista hasta 20 filas (la función `listarEntradas` usa ese tope por defecto), de la más reciente a la más antigua.

## Rutas y páginas

| Ruta | Archivo |
| --- | --- |
| `/entradas` | [`src/app/(panel)/entradas/page.tsx`](<../src/app/(panel)/entradas/page.tsx>) |

No hay ruta de detalle por token. El panel de inicio reutiliza la misma tabla con un tope de 12.

## Componentes

- [`EntradaPorQr`](../src/components/entrada-por-qr.tsx) orquesta consulta, ficha y confirmación.
- [`EscanerToken`](../src/components/escaner-token.tsx) lee el QR con la cámara (`BarcodeDetector` o jsQR) o desde una imagen.
- [`decodificar-imagen-qr.ts`](../src/components/decodificar-imagen-qr.ts) decodifica píxeles.
- [`TablaEntradas`](../src/components/tabla-entradas.tsx) lista lo ya guardado.
- [`PageFrame`](../src/components/page-frame.tsx) y las tarjetas de UI.

## Server actions

En [`entradas-paleta-acciones.ts`](../src/app/entradas-paleta-acciones.ts). Las dos exigen rango `administrador` o `recepcionista`.

| Acción | Llama a | Efecto |
| --- | --- | --- |
| `prepararEntradaPaleta` | `prepararEntrada` | No escribe. Devuelve la paleta ya registrada o la ficha cruzada. |
| `confirmarEntradaPaleta` | `recibirPaleta` | Avisa al otro dashboard, inserta y revalida `/` y `/entradas`. |

El alta usa `ON CONFLICT (token) DO NOTHING`. Si no inserta ninguna fila, responde que la paleta ya está registrada.

## Tablas

`entradas_paleta`. La crea el esquema de Supabase y también `asegurarEntradas` al vuelo, con el mismo `CREATE TABLE IF NOT EXISTS` y el índice `idx_entradas_paleta_fecha`.

RLS activado, sin políticas. Ver [persistencia](persistencia.md).

Este flujo no escribe en `lotes` ni en `movimientos`. Un token de paleta no abre stock de cava por sí solo.

## Código relacionado

- Página: [`src/app/(panel)/entradas/page.tsx`](<../src/app/(panel)/entradas/page.tsx>)
- Acciones: [`src/app/entradas-paleta-acciones.ts`](../src/app/entradas-paleta-acciones.ts)
- Reglas de alta: [`src/lib/entrada-paleta.ts`](../src/lib/entrada-paleta.ts)
- Formato del token: [`src/lib/token-paleta.ts`](../src/lib/token-paleta.ts)
- Dashboard remoto de prueba: [`src/lib/paleta-remota.ts`](../src/lib/paleta-remota.ts)
- Pruebas: [`src/lib/entrada-paleta.test.ts`](../src/lib/entrada-paleta.test.ts)
- Escáner: [`src/components/escaner-token.tsx`](../src/components/escaner-token.tsx)
