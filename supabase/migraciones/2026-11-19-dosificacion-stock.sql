-- La dosificación descuenta kilos de la entrada de esa paleta
-- y deja un movimiento de consumo ligado al registro.
-- Se puede ejecutar más de una vez.

ALTER TABLE dosificaciones ADD COLUMN IF NOT EXISTS anulada INTEGER NOT NULL DEFAULT 0;

ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS dosificacion_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_movimientos_dosificacion ON movimientos (dosificacion_id);
