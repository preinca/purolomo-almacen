# Dosificación

La pestaña **Dosificación** registra una paleta de un solo producto. Primero se elige el destino: **Producción** (40602-1), **Cerdo** (40602-3) o **Makilas** (San Pablo 60994, Induproca 60993, P.E.V 40644, Planta SST 60996). El listado y la anulación están en **Historial de Dosificaciones**. Las etiquetas se ven en **Etiquetas Paletas**. El QR de entrada es el de la paleta (`PLT-…`).

Cada registro guarda `destino` y `destino_codigo`. Sin destino no se guarda. Los registros anteriores, y los que decían `purolomo`, quedan como Producción 40602-1. Al guardar sale una etiqueta con QR (`PUROLOMO DOSIFICACION` y `ID:` de la dosificación). Desde esa pantalla se puede **Imprimir en Zebra** o **Guardar etiqueta** (descarga el ZPL y no lo manda a la impresora). En **Etiquetas Paletas** cada tarjeta tiene **Imprimir en Zebra** para volver a enviarla. El ZPL mide 5,7 cm × 3,2 cm, con el texto a la izquierda y el QR dibujado a la derecha. El QR impreso solo lleva `PUROLOMO DOSIFICACION` y el `ID`, para que los módulos queden grandes. Entra en la misma cola que usa el agente de la oficina. Ese QR no es el token de la entrada.

El nombre y el código salen de la entrada ya guardada o, si todavía no está, del kárdex. Si no hay nombre, se escriben a mano. El peso total es el peso unitario por la cantidad de unidades.

Al guardar, en la misma transacción:

1. Se comprueba que la paleta tenga una entrada y kilos disponibles (`kilos de la entrada` menos las dosificaciones vigentes de ese token).
2. Si no alcanzan, no se guarda y se avisa cuántos kilos quedan. Es el mismo criterio que una salida de TAG: no se deja el stock en negativo.
3. Si alcanzan, se guarda la dosificación y un movimiento `consumo` con el token de la paleta y el id de la dosificación.

Anular marca el registro y agrega un movimiento `devolucion` con los mismos kilos, así el stock vuelve.

La tabla `dosificaciones` ya está creada. Para el descuento hace falta `supabase/migraciones/2026-11-19-dosificacion-stock.sql`. Para el destino, `supabase/migraciones/2026-11-19-dosificacion-destino.sql`. El carmín de la calculadora, si la base se sembró antes, sigue en `supabase/migraciones/2026-11-19-carmin.sql`.
