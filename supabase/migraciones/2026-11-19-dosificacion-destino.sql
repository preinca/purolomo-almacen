-- Destino y código de planta de cada dosificación.
-- Los registros viejos (sin destino, o con el valor anterior purolomo) pasan a produccion.
-- Se puede ejecutar más de una vez.

ALTER TABLE dosificaciones ADD COLUMN IF NOT EXISTS destino TEXT;

ALTER TABLE dosificaciones ADD COLUMN IF NOT EXISTS destino_codigo TEXT;

ALTER TABLE dosificaciones DROP CONSTRAINT IF EXISTS dosificaciones_destino_ok;

UPDATE dosificaciones
SET destino = 'produccion'
WHERE destino IS NULL OR destino = '' OR destino = 'purolomo';

UPDATE dosificaciones SET destino_codigo = '40602-1'
WHERE destino = 'produccion' AND (destino_codigo IS NULL OR destino_codigo = '');

UPDATE dosificaciones SET destino_codigo = '40602-3'
WHERE destino = 'cerdo' AND (destino_codigo IS NULL OR destino_codigo = '');

UPDATE dosificaciones SET destino_codigo = '60994'
WHERE destino = 'makilas_san_pablo' AND (destino_codigo IS NULL OR destino_codigo = '');

UPDATE dosificaciones SET destino_codigo = '60993'
WHERE destino = 'makilas_turmero' AND (destino_codigo IS NULL OR destino_codigo = '');

UPDATE dosificaciones SET destino_codigo = '40644'
WHERE destino = 'makilas_pev' AND (destino_codigo IS NULL OR destino_codigo = '');

UPDATE dosificaciones SET destino_codigo = '60996'
WHERE destino = 'makilas_sst' AND (destino_codigo IS NULL OR destino_codigo = '');

ALTER TABLE dosificaciones ALTER COLUMN destino SET DEFAULT 'produccion';

ALTER TABLE dosificaciones ALTER COLUMN destino SET NOT NULL;

ALTER TABLE dosificaciones ADD CONSTRAINT dosificaciones_destino_ok CHECK (
  destino IN (
    'produccion',
    'cerdo',
    'makilas_san_pablo',
    'makilas_turmero',
    'makilas_pev',
    'makilas_sst'
  )
);
