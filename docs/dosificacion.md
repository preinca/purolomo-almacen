# Dosificación

La pestaña **Dosificación** (antes «Registrar salidas») registra una paleta de un solo producto. El QR es el mismo de la entrada (`PLT-…`). La cámara es la trasera principal, no la ultra gran angular: esa no enfoca de cerca. Si no lee, el token se escribe a mano.

El nombre y el código salen de la entrada ya guardada o, si todavía no está, del kárdex. Si no hay nombre, se escriben a mano. El peso total es el peso unitario por la cantidad de unidades.

Al guardar, en la misma transacción:

1. Se comprueba que la paleta tenga una entrada y kilos disponibles (`kilos de la entrada` menos las dosificaciones vigentes de ese token).
2. Si no alcanzan, no se guarda y se avisa cuántos kilos quedan. Es el mismo criterio que una salida de TAG: no se deja el stock en negativo.
3. Si alcanzan, se guarda la dosificación y un movimiento `consumo` con el token de la paleta y el id de la dosificación.

Anular marca el registro y agrega un movimiento `devolucion` con los mismos kilos, así el stock vuelve.

La tabla `dosificaciones` ya está creada. Para el descuento hace falta `supabase/migraciones/2026-11-19-dosificacion-stock.sql`. El carmín de la calculadora, si la base se sembró antes, sigue en `supabase/migraciones/2026-11-19-carmin.sql`.
