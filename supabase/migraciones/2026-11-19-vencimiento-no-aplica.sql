-- Empaque y otras paletas sin fecha de vencimiento.
-- Se puede ejecutar más de una vez.

ALTER TABLE entradas_paleta ADD COLUMN IF NOT EXISTS vencimiento_no_aplica INTEGER NOT NULL DEFAULT 0;

ALTER TABLE entradas_paleta ALTER COLUMN vencimiento DROP NOT NULL;

ALTER TABLE entradas_paleta DROP CONSTRAINT IF EXISTS entradas_paleta_vencimiento_ok;

ALTER TABLE entradas_paleta ADD CONSTRAINT entradas_paleta_vencimiento_ok CHECK (
  (vencimiento_no_aplica = 0 AND vencimiento IS NOT NULL)
  OR (vencimiento_no_aplica = 1 AND vencimiento IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_entradas_paleta_fefo ON entradas_paleta (vencimiento_no_aplica, vencimiento);
