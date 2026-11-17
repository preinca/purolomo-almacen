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

```bash
npm test
```
