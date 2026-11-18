# Purolomo · Almacén

Registro de entradas y salidas de materia prima cárnica. Por ahora cada paleta (TAG) se guarda en una base Postgres local, en `data/almacen`. Al registrar una salida para consumo, la aplicación guarda la trazabilidad: el TAG, los kilos y el token del mini lote quedan ligados al pesaje.

La salida para consumo usa la receta de Alibal. Hay que cargarla en **Cargar receta** antes de pesar.

## Correrlo en local

Hace falta Node.js 22 LTS. No hace falta Supabase ni `.env.local`.

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:47232](http://127.0.0.1:47232). La primera visita pide crear el administrador. Los datos siguen ahí al cerrar y volver a abrir la aplicación.

Cuando más adelante se use Supabase, define `DATABASE_URL` en `.env.local` (ver `.env.example`) y ejecuta `npm run db:migrar`.

## Kárdex externo

El QR de la paleta solo trae un token, por ejemplo `PLT-MPCM01009-1009111126-6-59651802`. El código y el lote van en el token (`PLT-<código>-<lote>-...`). El nombre, los kilos y el vencimiento los tiene el dashboard Purolomo Kárdex.

Con estas variables en `.env.local` (y en Vercel, en Environment Variables), al escanear en **Registrar entradas** el servidor entra a ese dashboard y consulta `POST /api/palleta/buscar`. La dirección no se escribe en el código: el túnel cambia.

- `KARDEX_EXTERNO_URL` — respaldo si todavía no llegó un reporte del túnel
- `KARDEX_EXTERNO_USUARIO`
- `KARDEX_EXTERNO_CLAVE`
- `KARDEX_EXTERNO_REPORTE_CLAVE` — la usa la computadora del dueño para avisar la URL nueva

El túnel rápido cambia en cada reinicio. Esa computadora corre `herramientas/reporte-tunel-windows/` y avisa a `POST /api/kardex-externo/url`. El almacén guarda la URL y la usa antes que `KARDEX_EXTERNO_URL`. El detalle y el SQL de Supabase están en [docs/kardex-externo.md](docs/kardex-externo.md).

La cookie de sesión se queda en el servidor. Si el kárdex no responde, se usa la copia local (`data/dashboard-remoto.json`) y, si tampoco tiene la paleta, se puede completar el producto, los kilos y el vencimiento a mano. Si el kárdex dice que el token no existe, no se registra. Sin usuario y clave del kárdex, el flujo local no cambia.

## Calculadora semanal

En el menú, **Calculadora semanal** arma la solicitud de materia prima no cárnica (y el empaque) a partir de los batches de lunes a viernes. El detalle está en [docs/calculadora-semanal.md](docs/calculadora-semanal.md).

```bash
npm test
```
