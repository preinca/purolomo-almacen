<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Documentación de flujos

Los flujos de Purolomo Almacén están en `docs/`. Cada archivo describe el propósito, los pasos, las rutas, los componentes, las server actions y las tablas de Supabase (RLS incluido), con enlaces al código.

- [Autenticación y sesión](docs/autenticacion.md): primer administrador, entrada, cookie firmada y salida.
- [Usuarios y permisos](docs/usuarios-y-permisos.md): rangos, menú y acciones de alta que todavía no tienen página.
- [Panel de inicio](docs/panel.md): conteo y últimas entradas de paleta.
- [Entradas de paleta por QR](docs/entradas-paleta.md): token `PLT-…`, consulta al otro dashboard y registro único.
- [Historial de entradas](docs/historial-de-entradas.md): paletas de `entradas_paleta`, en `/historial/entradas`.
- [Recepción de TAG en cava](docs/recepcion-tag.md): alta del lote que después se pesa. El formulario no está montado en `/entradas`.
- [Carga de receta](docs/recetas.md): Excel de Alibal 1 kg por línea, descarga y borrado.
- [Dosificación](docs/dosificacion.md): la pestaña de salidas. QR de la paleta, núcleo, peso unitario por cantidad y descuento del stock.
- [Historial de Dosificaciones](docs/historial-de-salidas.md): dosificaciones y, aparte, despachos y consumos de TAG, en `/historial/salidas`.
- [Solicitud MPNC](docs/calculadora-semanal.md): materia prima y empaque de la semana, en un solo guardado.
- [Salida para consumo](docs/salida-consumo.md): pesaje, mini lotes y cierre de la fórmula. Ya no está enlazada en el menú.
- [Salida para logística](docs/salida-logistica.md): el TAG sale de cava y deja de poder consumirse. Ya no está enlazada en el menú.
- [Ficha del TAG e historial](docs/lote-y-historial.md): kilos, movimientos, observación e impresión del navegador.
- [Inventario y stock](docs/inventario.md): cómo se calculan los kilos disponibles de cada TAG.
- [Búsqueda y lectura de QR](docs/busqueda-y-qr.md): escáner de TAG, de consumo y de token de paleta.
- [Impresión de etiquetas](docs/impresion.md): diálogo del navegador, cola ZPL y `GET`/`POST /api/impresion`.
- [Persistencia en Postgres](docs/persistencia.md): base local o Supabase, migración, tablas y RLS sin políticas.

Rangos (`src/lib/acceso.ts` y el menú de `src/components/shell.tsx`): administrador entra a todo; recepcionista suma `/entradas`; pesador suma `/salidas` (Dosificación); consulta, recepcionista y pesador comparten las rutas de lectura, incluidos los dos historiales. La calculadora no la ve el pesador.
