-- Migración: agrega coordenadas geográficas a establishments.
-- Es seguro correrla más de una vez (IF NOT EXISTS). No borra ni modifica
-- ningún dato existente, solo agrega dos columnas opcionales.

ALTER TABLE establishments ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_establishment_latitude') THEN
    ALTER TABLE establishments
      ADD CONSTRAINT chk_establishment_latitude CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_establishment_longitude') THEN
    ALTER TABLE establishments
      ADD CONSTRAINT chk_establishment_longitude CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180));
  END IF;
END
$$;
