# Dosificación

La pestaña **Dosificación** (antes «Registrar salidas») registra una paleta de un solo producto. Primero se elige el destino: **Producción** (40602-1), **Cerdo** (40602-3) o **Makilas** (San Pablo 60994, Turmero 60993, P.E.V 40644, Planta SST 60996). El QR de entrada es el de la paleta (`PLT-…`). La cámara es la trasera principal. Si no lee, el token se escribe a mano.

Cada registro guarda `destino` y `destino_codigo`. Sin destino no se guarda. Los registros anteriores, y los que decían `purolomo`, quedan como Producción 40602-1. Al guardar sale una etiqueta con QR (`PUROLOMO DOSIFICACION` y `ID:` de la dosificación). Se puede reimprimir desde el listado. Ese QR no es el token de la entrada.

El nombre y el código salen de la entrada ya guardada o, si todavía no está, del kárdex. Si no hay nombre, se escriben a mano. El peso total es el peso unitario por la cantidad de unidades.

Al guardar, en la misma transacción:

1. Se comprueba que la paleta tenga una entrada y kilos disponibles (`kilos de la entrada` menos las dosificaciones vigentes de ese token).
2. Si no alcanzan, no se guarda y se avisa cuántos kilos quedan. Es el mismo criterio que una salida de TAG: no se deja el stock en negativo.
3. Si alcanzan, se guarda la dosificación y un movimiento `consumo` con el token de la paleta y el id de la dosificación.

Anular marca el registro y agrega un movimiento `devolucion` con los mismos kilos, así el stock vuelve.

La tabla `dosificaciones` ya está creada. Para el descuento hace falta `supabase/migraciones/2026-11-19-dosificacion-stock.sql`. Para el destino, `supabase/migraciones/2026-11-19-dosificacion-destino.sql`. El carmín de la calculadora, si la base se sembró antes, sigue en `supabase/migraciones/2026-11-19-carmin.sql`.
