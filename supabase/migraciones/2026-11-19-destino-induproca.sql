-- Turmero pasa a llamarse Induproca. El código de planta sigue siendo 60993.
-- Se puede ejecutar más de una vez.

ALTER TABLE dosificaciones DROP CONSTRAINT IF EXISTS dosificaciones_destino_ok;

UPDATE dosificaciones
SET destino = 'makilas_induproca'
WHERE destino = 'makilas_turmero';

ALTER TABLE dosificaciones ADD CONSTRAINT dosificaciones_destino_ok CHECK (
  destino IN (
    'produccion',
    'cerdo',
    'makilas_san_pablo',
    'makilas_induproca',
    'makilas_pev',
    'makilas_sst'
  )
);
