# Historial de entradas

## Propósito

Lista cada paleta registrada en almacén, de la más reciente a la más antigua. El título de la página es **Historial de entradas**.

En producción esa lista lee la tabla `lotes` (recepciones por TAG) y no está en el menú. Aquí la entrada real es el QR de la paleta, así que la lista lee `entradas_paleta`. El menú sí la muestra, para cualquier rango con sesión.

No hay filtro, paginación por páginas ni exportación. Producción tampoco los tiene en este flujo. El tope es de 300 filas, el mismo que `listarLotes` en el historial de producción. El filtro por producto y día, y el PDF, en producción viven en **Registro de entrada**, que en almacén no existe como pantalla.

## Quién lo usa

Cualquier rango con sesión: administrador, consulta, recepcionista y pesador. `/historial` está en las rutas de consulta, así que `/historial/entradas` también. El menú lo muestra a todos.

Registrar una paleta nueva sigue en **Registrar entradas** y solo lo hacen administrador y recepcionista.

## Pasos

1. El usuario abre **Historial de entradas** o entra a `/historial/entradas`.
2. `listarHistorialEntradas` trae hasta 300 filas de `entradas_paleta`.
3. La tabla muestra fecha, hora de `creado_en` en `America/Caracas`, producto, código, lote, kilos, kilos disponibles, vencimiento, usuario y token. Los disponibles son los kilos de la paleta menos las dosificaciones vigentes.
4. Si no hay filas, dice «Todavía no hay entradas.»

No hay alta en esta página. Cada alta sigue en el escáner de `/entradas`, que guarda la fila y vuelve a validar esta ruta.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/historial/entradas` | Últimas 300 paletas |

## Componentes

- `PageFrame`
- `TablaEntradas` con hora y usuario
- `Card`

La hora y el usuario no están en la tabla corta de Inicio ni en Registrar entradas. Esos datos sí se guardan en cada entrada, y el historial los muestra.

## Server actions y API routes

Ninguna en esta página. Al confirmar una paleta, `confirmarEntradaPaleta` llama a `revalidatePath("/historial/entradas")`.

## Tablas y consultas

Tabla `entradas_paleta`. RLS activado, sin políticas. La app usa la conexión directa y no pasa por RLS.

```sql
SELECT e.*,
  e.kg - COALESCE((
    SELECT SUM(d.peso_total) FROM dosificaciones d
    WHERE d.token = e.token AND d.anulada = 0
  ), 0) AS kg_disponible
FROM entradas_paleta e
ORDER BY e.creado_en DESC, e.token DESC
LIMIT 300
```

No se lee `lotes` ni `movimientos`. Una paleta de este flujo no tiene TAG, semana, estado ni kilos restantes: eso pertenece al TAG de cava, que es otro registro.

Columnas que se ven y de dónde salen:

| Columna | Campo |
| --- | --- |
| Fecha | `fecha` |
| Hora | `creado_en` |
| Producto y código | `producto`, `codigo` |
| Lote | `lote` |
| Kilos | `kg` |
| Vencimiento | `vencimiento` |
| Usuario | `usuario` |
| Token | `token` |

El orden es la hora de registro, no el día de `fecha`. Producción ordena los TAG por `fecha` y `tag`. Aquí varias paletas comparten el día y el token desempata.

## Variables de entorno

- `DATABASE_URL` o `POSTGRES_URL`. Si no hay ninguna, la app usa la base local de `data/almacen`.
- `SESION_SECRETO`.

## Archivos relacionados

- [src/app/(panel)/historial/entradas/page.tsx](<../src/app/(panel)/historial/entradas/page.tsx>)
- [src/components/tabla-entradas.tsx](../src/components/tabla-entradas.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/lib/entrada-paleta.ts](../src/lib/entrada-paleta.ts)
- [src/lib/formato.ts](../src/lib/formato.ts)
- [src/app/entradas-paleta-acciones.ts](../src/app/entradas-paleta-acciones.ts)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
