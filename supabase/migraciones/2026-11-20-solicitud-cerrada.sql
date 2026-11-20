-- La solicitud MPNC se guarda una sola vez.
-- cerrado = 1 impide volver a cambiar batches o cantidades.
-- Se puede ejecutar más de una vez.

ALTER TABLE calc_planes ADD COLUMN IF NOT EXISTS cerrado INTEGER NOT NULL DEFAULT 0;
