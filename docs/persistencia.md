# Persistencia en Postgres

## Propósito

Todas las pantallas leen y escriben por una sola conexión de aplicación, `getDb()`. No usan el cliente de Supabase ni la clave anónima. En local, si no hay URL, los datos quedan en un Postgres embebido. Con URL, la misma capa habla con Supabase.

Las fechas de negocio y `creado_en` se guardan como texto ISO, no como `timestamptz`, para no cambiar el formato que ya usaba la aplicación.

## Qué base se abre

`urlBaseDatos` mira, en este orden, `DATABASE_URL` y `POSTGRES_URL`.

| Situación | Qué ocurre |
| --- | --- |
| Alguna de las dos variables tiene valor | Conexión `postgres` hacia esa URL. `prepare: false` (el pooler de Supabase en modo transacción no admite sentencias preparadas). SSL obligatorio salvo que el host sea `localhost` o `127.0.0.1`. |
| En Vercel (`VERCEL` definida) | Una sola conexión. |
| Fuera de Vercel | Hasta `DB_MAX_CONEXIONES` conexiones, o 3 si esa variable no está. Nunca hay más consultas en vuelo que conexiones, para no dejar colgado el pooler. |
| Ninguna URL | PGlite en el directorio `data/almacen`. Al abrir, ejecuta `supabase/esquema.sql` y siembra `productos` con el catálogo del código. |

Los `?` de las consultas se convierten a `$1`, `$2`… fuera de las comillas. `run` devuelve cuántas filas cambiaron. `transaction` anida reutilizando la misma transacción.

Si la base no responde, [`error.tsx`](../src/app/error.tsx) muestra «No se pudo abrir la base» y un botón para reintentar.

## Migración a Supabase

`npm run db:migrar` ejecuta [`scripts/migrar-supabase.ts`](../scripts/migrar-supabase.ts).

1. Lee `DATABASE_URL` desde `.env.local` (el script de npm usa `--env-file=.env.local`).
2. Aplica [`supabase/esquema.sql`](../supabase/esquema.sql). Se puede repetir: las tablas usan `CREATE TABLE IF NOT EXISTS` y las columnas nuevas usan `ADD COLUMN IF NOT EXISTS`.
3. Si Supabase ya tiene filas en `lotes`, `movimientos`, `pesajes` o `minilotes`, no copia nada.
4. Si no, siembra el catálogo y, si existe la base SQLite local, copia solo `usuarios`, `productos` y `recetas` (con sus ítems). La ruta SQLite es `SQLITE_PATH` o, si no está, `data/produccion.sqlite`.
5. Lotes, movimientos, pesajes y mini lotes no se copian: la prueba piloto empieza en cero. Sin archivo SQLite, Supabase queda sin usuarios y el primer acceso a `/entrar` crea el administrador.

## Tablas

| Tabla | La usan |
| --- | --- |
| `usuarios` | [Autenticación](autenticacion.md), [usuarios](usuarios-y-permisos.md) |
| `entradas_paleta` | [Panel](panel.md), [entradas de paleta](entradas-paleta.md) |
| `productos` | [Recepción de TAG](recepcion-tag.md), [inventario](inventario.md) |
| `lotes` | Recepción, [inventario](inventario.md), [ficha](lote-y-historial.md), salidas, [impresión](impresion.md) |
| `movimientos` | Historial de cada TAG y salidas |
| `procesos_recepcion` | [Recepción de TAG](recepcion-tag.md) |
| `recetas`, `receta_items` | [Recetas](recetas.md), [consumo](salida-consumo.md) |
| `pesajes`, `minilotes` | [Consumo](salida-consumo.md), [búsqueda](busqueda-y-qr.md) |
| `app_meta` | Contador `minilote_seq` |
| `impresiones`, `impresion_items` | [Impresión](impresion.md) |

`entradas_paleta` también se crea al vuelo desde el código (`asegurarEntradas`), con la misma definición que el esquema.

## RLS

El esquema activa `ROW LEVEL SECURITY` en todas las tablas de arriba, incluidas `entradas_paleta` y `procesos_recepcion`. No hay ningún `CREATE POLICY` ni `FORCE ROW LEVEL SECURITY`.

El comentario del esquema lo dice así: la aplicación entra con la conexión directa a Postgres, que no pasa por RLS, y activar RLS sin políticas cierra estas tablas a la API pública de Supabase (rol `anon`). Quien use la clave anónima o la API REST no puede leer ni escribir. El rol dueño de las tablas, que es el de `DATABASE_URL`, sigue pudiendo hacerlo mientras no se fuerce RLS.

No hay buckets de Storage, vistas, funciones `security definer` ni políticas de Realtime en este repositorio.

## Variables de entorno

Solo los nombres. Los valores no van en la documentación.

| Nombre | Dónde se lee |
| --- | --- |
| `DATABASE_URL` | Conexión y migración. Documentada en [`.env.example`](../.env.example). |
| `POSTGRES_URL` | Alternativa a `DATABASE_URL` en [`db.ts`](../src/lib/db.ts). |
| `DB_MAX_CONEXIONES` | Tope del pool fuera de Vercel. |
| `VERCEL` | Si está definida, el pool usa una conexión. |
| `SQLITE_PATH` | Origen opcional de la copia de usuarios y recetas. |
| `SESION_SECRETO` | Firma de la cookie. Ver [autenticación](autenticacion.md). |
| `IMPRESION_CLAVE` | API de la cola Zebra. Ver [impresión](impresion.md). |

## Código relacionado

- Conexión: [`src/lib/db.ts`](../src/lib/db.ts)
- Placeholders y arreglos: [`src/lib/arreglo-pg.ts`](../src/lib/arreglo-pg.ts)
- Esquema: [`supabase/esquema.sql`](../supabase/esquema.sql)
- Migración: [`scripts/migrar-supabase.ts`](../scripts/migrar-supabase.ts)
- Base de pruebas: [`src/lib/db-prueba.ts`](../src/lib/db-prueba.ts)
- Pruebas de la capa SQL: [`src/lib/db.test.ts`](../src/lib/db.test.ts)
- Arranque local: [`README.md`](../README.md)
- Ejemplo de variables: [`.env.example`](../.env.example)
