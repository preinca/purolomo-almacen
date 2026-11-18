# Kárdex externo y túnel que cambia

El QR de la paleta solo trae un token (`PLT-<código>-<lote>-...`). El nombre, los kilos y el vencimiento los consulta el servidor en el dashboard Purolomo Kárdex: entra con usuario y clave, guarda la cookie y llama a `POST /api/palleta/buscar`.

Ese dashboard se publica con un túnel rápido de Cloudflare (`*.trycloudflare.com`). La dirección cambia cada vez que se reinicia `cloudflared`. No se deja un túnel fijo. La computadora donde corre el dashboard avisa la dirección nueva.

## Variables

En Vercel, Project → Settings → Environment Variables (Production y Preview):

| Variable | Para qué |
|---|---|
| `KARDEX_EXTERNO_USUARIO` | Usuario del dashboard Flask |
| `KARDEX_EXTERNO_CLAVE` | Clave de ese usuario |
| `KARDEX_EXTERNO_REPORTE_CLAVE` | Clave compartida con la computadora que reporta el túnel |
| `KARDEX_EXTERNO_URL` | Respaldo. Se usa solo si todavía no hay una URL reportada |
| `KARDEX_EXTERNO_HOSTS_PERMITIDOS` | Opcional. Lista separada por comas. Por defecto `.trycloudflare.com` |

La clave de reporte no es la clave del dashboard. Genera otra:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

## SQL para Supabase

Pégalo en el SQL Editor del proyecto. Se puede ejecutar más de una vez: no borra datos.

```sql
CREATE TABLE IF NOT EXISTS kardex_externo_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  url TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

ALTER TABLE kardex_externo_config ENABLE ROW LEVEL SECURITY;
```

La aplicación también crea la tabla al primer reporte o a la primera consulta, si el usuario de `DATABASE_URL` puede hacerlo. Conviene aplicar el SQL igual, para dejar la tabla cerrada a la API pública de Supabase. La app entra por la conexión directa y no usa la clave anon.

## Cómo se elige la dirección

1. La fila de `kardex_externo_config`, si existe.
2. Si no, `KARDEX_EXTERNO_URL`.

Cuando la URL reportada cambia, se tira la cookie de sesión del kárdex y el siguiente escaneo vuelve a entrar.

El reporte es `POST /api/kardex-externo/url` con `Authorization: Bearer <KARDEX_EXTERNO_REPORTE_CLAVE>` y un JSON `{"url":"https://….trycloudflare.com"}`. Solo acepta `https` y un host permitido. Otra cosa se rechaza. Hay un tope de 20 reportes por minuto y por dirección de origen.

En **Registrar entradas**, el administrador ve la URL vigente y cuándo se reportó. El recepcionista no.

La instalación en Windows está en `herramientas/reporte-tunel-windows/README.md`.
