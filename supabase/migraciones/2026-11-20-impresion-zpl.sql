-- La etiqueta de paleta guarda el ZPL en el trabajo. Los TAG de cava siguen armándolo al tomarlo.
ALTER TABLE impresiones ADD COLUMN IF NOT EXISTS zpl TEXT NOT NULL DEFAULT '';
