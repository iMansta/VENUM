-- =====================================================================
-- VENUM - Dynamic PvE mob_kill threshold
-- Adds mission-level min fame threshold used by Anaconda inference.
-- =====================================================================

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS min_fame_threshold INTEGER;

COMMENT ON COLUMN public.missions.min_fame_threshold IS
  'Minimum fame delta required to infer mob_kill for this mission.';

