-- =====================================================================
-- Missões auto-rastreáveis via Anaconda
-- - adiciona tipo de missão PvE
-- - recria função de agregação para alvo/tipo (kill/fama)
-- =====================================================================

DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname
  INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.missions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%mission_type%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.missions DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE public.missions
  ADD CONSTRAINT missions_mission_type_check
  CHECK (mission_type IN ('gathering', 'crafting', 'pve', 'pvp', 'trading', 'other'));

SELECT 'Mission type atualizado. Execute também UPDATE_CELESTE_AGGREGATION.sql.' AS status;
