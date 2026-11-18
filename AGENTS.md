<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Purolomo Almacén

Registro de entradas y salidas de materia prima. Next.js 16 en Vercel y Postgres en Supabase, con el cliente `postgres` y la conexión directa (`DATABASE_URL` o `POSTGRES_URL`). Sin esas variables, el desarrollo usa la base local de `data/almacen`. La sesión es una cookie firmada (`SESION_SECRETO`). El esquema está en `supabase/esquema.sql`: RLS activado y sin políticas. `npm run db:migrar` lo aplica y se puede volver a ejecutar.

Antes de cambiar un flujo documentado, lee su archivo en `docs/`.

## Flujos

- [docs/historial-de-entradas.md](docs/historial-de-entradas.md) — paletas de `entradas_paleta`, en `/historial/entradas`.
- [docs/historial-de-salidas.md](docs/historial-de-salidas.md) — despachos y consumos de `movimientos`, en `/historial/salidas`.

Rangos (`src/lib/acceso.ts` y el menú de `src/components/shell.tsx`): administrador entra a todo; recepcionista suma `/entradas`; pesador suma `/salidas`; consulta, recepcionista y pesador comparten las rutas de lectura, incluidos los dos historiales. La salida a logística, dentro de `/salidas`, la ve y la ejecuta solo el administrador.
