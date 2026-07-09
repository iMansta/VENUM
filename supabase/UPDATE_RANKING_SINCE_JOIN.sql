-- =====================================================================
-- Ranking a partir da ENTRADA na guild (não fama total / lifetime)
-- =====================================================================
-- Cada perfil ganha um "baseline" de fama capturado no primeiro sync após
-- entrar/ser verificado na guild. O ranking de PvP/PvE/Coleta mostra apenas
-- a fama conquistada DEPOIS disso (current - baseline). O ranking de missões
-- passa a somar os pontos efetivamente premiados (mission_reward_events),
-- que só existem após a entrada na guild.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS base_kill_fame BIGINT,
  ADD COLUMN IF NOT EXISTS base_pve_fame BIGINT,
  ADD COLUMN IF NOT EXISTS base_gathering_fame BIGINT,
  ADD COLUMN IF NOT EXISTS fame_baseline_at TIMESTAMPTZ;

-- Backfill: membros existentes passam a contar a partir de agora
-- (fama já acumulada vira baseline).
UPDATE public.profiles
SET base_kill_fame = COALESCE(albion_kill_fame, 0),
    base_pve_fame = COALESCE(albion_pve_fame, 0),
    base_gathering_fame = COALESCE(albion_gathering_fame, 0),
    fame_baseline_at = COALESCE(joined_at, NOW())
WHERE fame_baseline_at IS NULL;

-- Captura automática do baseline no primeiro sync de fama após a entrada.
CREATE OR REPLACE FUNCTION public.capture_guild_fame_baseline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fame_baseline_at IS NULL AND NEW.albion_fame_synced_at IS NOT NULL THEN
    NEW.base_kill_fame := COALESCE(NEW.albion_kill_fame, 0);
    NEW.base_pve_fame := COALESCE(NEW.albion_pve_fame, 0);
    NEW.base_gathering_fame := COALESCE(NEW.albion_gathering_fame, 0);
    NEW.fame_baseline_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_guild_fame_baseline ON public.profiles;
CREATE TRIGGER trg_capture_guild_fame_baseline
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.fame_baseline_at IS NULL AND NEW.albion_fame_synced_at IS NOT NULL)
  EXECUTE FUNCTION public.capture_guild_fame_baseline();

-- ---------------------------------------------------------------------
-- Ranking de fama do período (desde a entrada na guild)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_guild_fame_ranking(
  p_category TEXT DEFAULT 'pvp',
  p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (
  profile_id UUID,
  username TEXT,
  albion_character_name TEXT,
  fame_delta BIGINT,
  rank BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deltas AS (
    SELECT
      p.id AS profile_id,
      p.username,
      p.albion_character_name,
      GREATEST(
        0,
        CASE p_category
          WHEN 'pvp' THEN COALESCE(p.albion_kill_fame, 0) - COALESCE(p.base_kill_fame, 0)
          WHEN 'pve' THEN COALESCE(p.albion_pve_fame, 0) - COALESCE(p.base_pve_fame, 0)
          WHEN 'gathering' THEN COALESCE(p.albion_gathering_fame, 0) - COALESCE(p.base_gathering_fame, 0)
          ELSE 0
        END
      )::BIGINT AS fame_delta
    FROM public.profiles p
    WHERE COALESCE(p.is_active, TRUE) = TRUE
  )
  SELECT
    profile_id,
    username,
    albion_character_name,
    fame_delta,
    ROW_NUMBER() OVER (ORDER BY fame_delta DESC)::BIGINT AS rank
  FROM deltas
  WHERE fame_delta > 0
  ORDER BY fame_delta DESC
  LIMIT GREATEST(COALESCE(p_limit, 30), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_guild_fame_ranking(TEXT, INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- Ranking de missões: pontos efetivamente premiados na guild
-- (mission_reward_events só existe após a entrada na guild).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mission_completion_ranking(
  p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (
  profile_id UUID,
  username TEXT,
  albion_character_name TEXT,
  completed_missions BIGINT,
  total_points BIGINT,
  rank BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      p.id AS profile_id,
      p.username,
      p.albion_character_name,
      COUNT(mre.id)::BIGINT AS completed_missions,
      COALESCE(SUM(mre.awarded_points), 0)::BIGINT AS total_points
    FROM public.profiles p
    LEFT JOIN public.mission_reward_events mre
      ON mre.profile_id = p.id
     AND (p.fame_baseline_at IS NULL OR mre.awarded_at >= p.fame_baseline_at)
    WHERE COALESCE(p.is_active, TRUE) = TRUE
    GROUP BY p.id, p.username, p.albion_character_name
  )
  SELECT
    profile_id,
    username,
    albion_character_name,
    completed_missions,
    total_points,
    ROW_NUMBER() OVER (ORDER BY total_points DESC, completed_missions DESC)::BIGINT AS rank
  FROM agg
  WHERE total_points > 0 OR completed_missions > 0
  ORDER BY total_points DESC, completed_missions DESC
  LIMIT GREATEST(COALESCE(p_limit, 30), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_completion_ranking(INTEGER) TO anon, authenticated;

SELECT 'UPDATE_RANKING_SINCE_JOIN aplicado' AS status;
