-- Destino de cada dosificación: Purolomo, Makilas San Pablo o Makilas Turmero.
-- Los registros anteriores quedan como purolomo. Se puede ejecutar más de una vez.

ALTER TABLE dosificaciones ADD COLUMN IF NOT EXISTS destino TEXT;

UPDATE dosificaciones
SET destino = 'purolomo'
WHERE destino IS NULL OR destino = '';

ALTER TABLE dosificaciones ALTER COLUMN destino SET DEFAULT 'purolomo';

ALTER TABLE dosificaciones ALTER COLUMN destino SET NOT NULL;

ALTER TABLE dosificaciones DROP CONSTRAINT IF EXISTS dosificaciones_destino_ok;

ALTER TABLE dosificaciones ADD CONSTRAINT dosificaciones_destino_ok CHECK (
  destino IN ('purolomo', 'makilas_san_pablo', 'makilas_turmero')
);
