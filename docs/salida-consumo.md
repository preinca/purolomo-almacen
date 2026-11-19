# Salida para consumo

## Propósito

Pesa la fórmula de Alibal 1 kg. Cada retiro descuenta kilos de un TAG de cava, deja un movimiento `despacho` y crea un mini lote (token `ML…`) ligado a ese pesaje. Así el TAG, los kilos y el token quedan atados al pesaje.

Hay que tener la receta de la línea cargada. El flujo de la receta está en [recetas](recetas.md). El TAG tiene que existir en `lotes` (ver [recepción de TAG](recepcion-tag.md) y [inventario](inventario.md)).

## Quién lo usa

Administrador y pesador. El administrador, además, ve la opción de logística en la misma página. Consulta y recepcionista no entran a `/salidas`.

## Pasos del usuario

1. Abre **Registrar salidas** (`/salidas`).
2. Elige **Salida para consumo**. La ruta queda en `/salidas?modo=consumo`.
3. Elige el producto. Hoy el único botón es **ALIBAL 1 K** (`/salidas?modo=consumo&producto=ALIBAL%201%20K`).
4. Si esa línea no tiene receta vigente, el texto manda a **Cargar receta** y no deja abrir el pesaje.
5. Indica la fecha (por defecto, hoy en Caracas) y la línea. El número de pesaje lo propone la aplicación: el máximo de `pesajes` de ese destino más uno, entre 1 y 99. No se puede abrir otro pesaje mientras haya uno con `finalizado = 0` para Alibal 1 kg.
6. **Abrir pesaje** crea la fila, copia el `receta_id` vigente y redirige a `/salidas?modo=consumo&producto=ALIBAL%201%20K&pesaje=<id>`.
7. Para cada partida, escanea el QR del TAG, escribe el número (4 a 8 dígitos) o sube una imagen. La ficha muestra producto, kilos disponibles y otros TAG del mismo tipo con stock.
8. Escribe los kilos y, si hace falta, una nota de hasta 500 caracteres. **Registrar consumo** comprueba:
   - el pesaje sigue abierto;
   - el TAG existe y su tipo está en la receta;
   - el TAG no está en `LOGISTICA` y le alcanzan los kilos;
   - el tipo y el total no se salen del máximo de la fórmula;
   - la línea no supera su capacidad (1800 kg la línea 1, 3600 kg la línea 2).
9. Si pasa, suma `kg_despachados`, anota el destino en el lote, inserta el movimiento `despacho` y un mini lote. La URL vuelve con `token=` para mostrar el token recién creado.
10. Mientras el pesaje no esté finalizado se puede **quitar** un retiro: resta los kilos, borra el movimiento de despacho coincidente y borra el mini lote.
11. La observación del pesaje (máximo 500) la guarda `guardarObservacionPesajeFormulario`.
12. **Finalizar** exige que cada partida haya llegado al menos a su mínimo y que el total esté entre el mínimo y el máximo del pesaje. Marca `finalizado = 1`, guarda `registrado_en` y redirige con `cerrado=1`. Arma un código corto con el número, la línea y el sufijo de los mini lotes.
13. **Eliminar el pesaje en proceso** pide confirmación. Devuelve los kilos a cada TAG, borra mini lotes, movimientos de esos retiros y el pesaje. No se puede eliminar uno ya finalizado.

Un pesaje ya finalizado sigue visible si se abre por `pesaje=<id>`, pero no admite más retiros ni quitas.

## Rutas

| Ruta | Uso |
| --- | --- |
| `/salidas` | Elige consumo o, si es administrador, logística. |
| `/salidas?modo=consumo` | Elige el producto. |
| `/salidas?modo=consumo&producto=ALIBAL%201%20K` | Abre o continúa el pesaje. |
| `/salidas?modo=consumo&producto=…&pesaje=<id>` | Pesaje concreto. |
| `aviso`, `tono`, `token`, `cerrado` | Mensajes y el último token. |

La página enlaza a `/qr/pesaje/<id>` y a `/qr/imagen/<tag>`. Esas rutas no tienen archivo en `src/app`. El enlace de descarga del QR no resuelve a un handler de este repositorio.

## Componentes

- [`SalidaAlibal`](../src/components/salida-alibal.tsx): abrir pesaje, consumir, quitar, finalizar, eliminar y observación.
- [`EscanerSalida`](../src/components/escaner-salida.tsx): cámara, imagen, PDF de etiqueta o texto de QR. El detalle del lector está en [búsqueda y QR](busqueda-y-qr.md).
- [`FormObservacion`](../src/components/form-observacion.tsx).

La página servidora es [`salidas/page.tsx`](<../src/app/(panel)/salidas/page.tsx>). Arma el progreso, las existencias de los tipos de la receta y los mini lotes.

## Server actions

En [`actions.ts`](../src/app/actions.ts). Salvo la lectura, exigen `administrador` o `pesador`.

| Acción | Función de dominio |
| --- | --- |
| `numeroSiguientePesaje` | `siguienteNumero` |
| `abrirPesajeFormulario` | `abrirPesaje` |
| `consumirPesajeFormulario` | `consumirEnPesaje` → `registrarDespacho` |
| `quitarKgPesajeFormulario` | `quitarKgDePesaje` |
| `finalizarPesajeFormulario` | `finalizarPesaje` |
| `eliminarPesajeEnCursoFormulario` | `eliminarPesajeEnCurso` |
| `guardarObservacionPesajeFormulario` | `guardarObservacionPesaje` |
| `loteActualDesdeTag` / `loteActualDesdeQr` | Lectura para la ficha. Cualquier sesión. |

`crearDespacho` y `crearConsumo` también están exportadas y exigen administrador, pero ningún componente las usa. El consumo del pesaje entra por `registrarDespacho` (suma `kg_despachados`). `registrarConsumo` sumaría `kg_consumidos` y un movimiento `consumo`; no forma parte de esta pantalla.

El token del mini lote sale de `app_meta.clave = 'minilote_seq'` en una sola sentencia, para que dos pesajes no repitan código. El formato nuevo es `ML` más cuatro caracteres en base 36. Se siguen aceptando tokens viejos `ML` más seis dígitos.

## Tablas

| Tabla | Uso |
| --- | --- |
| `pesajes` | Cabecera. Único `(fecha, destino, linea, numero)`. |
| `recetas` y `receta_items` | Fórmula congelada por `receta_id`. |
| `lotes` | Resta disponibles al despachar (`kg_recibidos - kg_despachados - kg_consumidos`). |
| `movimientos` | Fila `despacho` con destino, línea, kilos y nota. |
| `minilotes` | Token, TAG, pesaje, tipo, kilos, destino y línea. |
| `app_meta` | Contador `minilote_seq`. |

RLS activado, sin políticas. Ver [persistencia](persistencia.md).

Los lotes se bloquean con `SELECT … FOR UPDATE` dentro de la transacción para que dos salidas no descuenten el mismo kilo.

## Código relacionado

- Página: [`src/app/(panel)/salidas/page.tsx`](<../src/app/(panel)/salidas/page.tsx>)
- Pantalla: [`src/components/salida-alibal.tsx`](../src/components/salida-alibal.tsx)
- Escáner: [`src/components/escaner-salida.tsx`](../src/components/escaner-salida.tsx)
- Pesajes y mini lotes: [`src/lib/pesajes.ts`](../src/lib/pesajes.ts)
- Despacho sobre el lote: [`src/lib/lotes.ts`](../src/lib/lotes.ts)
- Tokens: [`src/lib/minilote.ts`](../src/lib/minilote.ts)
- Destinos admitidos: [`src/lib/destinos.ts`](../src/lib/destinos.ts)
- Pruebas: [`src/lib/pesajes.test.ts`](../src/lib/pesajes.test.ts)
- Acciones: [`src/app/actions.ts`](../src/app/actions.ts)
