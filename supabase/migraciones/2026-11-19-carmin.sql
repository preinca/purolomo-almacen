-- Une el carmín de MTD Con Todo en la fila del Excel.
-- MPCM01182 (0,468 kg/batch) pasa a MPCM01004.
-- Se puede ejecutar más de una vez.

UPDATE calc_receta_items AS origen
SET codigo = 'MPCM01004'
WHERE origen.codigo = 'MPCM01182'
  AND origen.tipo = 'mpnc'
  AND NOT EXISTS (
    SELECT 1
    FROM calc_receta_items AS destino
    WHERE destino.receta_id = origen.receta_id
      AND destino.codigo = 'MPCM01004'
      AND destino.tipo = 'mpnc'
      AND destino.id <> origen.id
  );

UPDATE calc_receta_items AS destino
SET kg_por_batch = COALESCE(destino.kg_por_batch, 0) + COALESCE(origen.kg_por_batch, 0)
FROM calc_receta_items AS origen
WHERE destino.codigo = 'MPCM01004'
  AND destino.tipo = 'mpnc'
  AND origen.codigo = 'MPCM01182'
  AND origen.tipo = 'mpnc'
  AND destino.receta_id = origen.receta_id;

DELETE FROM calc_receta_items AS origen
WHERE origen.codigo = 'MPCM01182'
  AND origen.tipo = 'mpnc'
  AND EXISTS (
    SELECT 1
    FROM calc_receta_items AS destino
    WHERE destino.receta_id = origen.receta_id
      AND destino.codigo = 'MPCM01004'
      AND destino.tipo = 'mpnc'
  );

UPDATE calc_plan_solicitado AS origen
SET codigo = 'MPCM01004'
WHERE origen.codigo = 'MPCM01182'
  AND origen.tipo = 'mpnc'
  AND NOT EXISTS (
    SELECT 1
    FROM calc_plan_solicitado AS destino
    WHERE destino.plan_id = origen.plan_id
      AND destino.codigo = 'MPCM01004'
      AND destino.tipo = 'mpnc'
  );

UPDATE calc_plan_solicitado AS destino
SET cantidad = COALESCE(destino.cantidad, 0) + COALESCE(origen.cantidad, 0)
FROM calc_plan_solicitado AS origen
WHERE destino.codigo = 'MPCM01004'
  AND destino.tipo = 'mpnc'
  AND origen.codigo = 'MPCM01182'
  AND origen.tipo = 'mpnc'
  AND destino.plan_id = origen.plan_id;

DELETE FROM calc_plan_solicitado
WHERE codigo = 'MPCM01182'
  AND tipo = 'mpnc';

DELETE FROM calc_catalogo
WHERE codigo = 'MPCM01182'
  AND tipo = 'mpnc';
