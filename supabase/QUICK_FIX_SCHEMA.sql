-- =====================================================================
-- VENUM — QUICK FIX (rode no SQL Editor do Supabase se o app der 404/400)
-- Idempotente. Seguro rodar mais de uma vez.
-- Depois, se ainda faltar algo, rode na ordem:
--   00_SCHEMA_BASE → UPDATE_PRODUCTION → UPDATE_PHASE2 → UPDATE_BUILDS_AND_RANKING
-- =====================================================================

-- 1) Colunas faltantes em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_character_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_kill_fame BIGINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_pve_fame BIGINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_gathering_fame BIGINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_fame_synced_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_albion_name
  ON public.profiles (lower(albion_character_name));

-- 2) Loja (shop_items)
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cost_points INTEGER NOT NULL,
  stock INTEGER DEFAULT -1,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active shop items are viewable by members" ON public.shop_items;
CREATE POLICY "Active shop items are viewable by members"
  ON public.shop_items FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Officers can manage shop" ON public.shop_items;
CREATE POLICY "Officers can manage shop"
  ON public.shop_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

-- 3) Baseline de fama mensal
CREATE TABLE IF NOT EXISTS public.profile_fame_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  kill_fame BIGINT NOT NULL DEFAULT 0,
  pve_fame BIGINT NOT NULL DEFAULT 0,
  gathering_fame BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, month_key)
);

ALTER TABLE public.profile_fame_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view fame baselines" ON public.profile_fame_baselines;
CREATE POLICY "Members can view fame baselines"
  ON public.profile_fame_baselines FOR SELECT USING (true);

-- 4) Fix get_market_settings
DROP FUNCTION IF EXISTS public.get_market_settings();

CREATE OR REPLACE FUNCTION public.get_market_settings()
RETURNS TABLE (min_profit NUMERIC, min_margin_pct NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(ms.min_profit, 100::NUMERIC),
    COALESCE(ms.min_margin_pct, 0.02::NUMERIC)
  FROM public.market_settings ms
  WHERE ms.id = 1
  UNION ALL
  SELECT 100::NUMERIC, 0.02::NUMERIC
  WHERE NOT EXISTS (SELECT 1 FROM public.market_settings WHERE id = 1)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_market_settings() TO anon, authenticated;

-- 5) Ranking missões
DROP FUNCTION IF EXISTS public.get_mission_completion_ranking(INTEGER);

CREATE OR REPLACE FUNCTION public.get_mission_completion_ranking(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  profile_id UUID,
  username TEXT,
  albion_character_name TEXT,
  completed_missions BIGINT,
  total_points BIGINT,
  rank BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      p.id AS profile_id,
      p.username,
      COALESCE(NULLIF(p.albion_character_name, ''), p.username) AS albion_character_name,
      COUNT(DISTINCT m.id) AS completed_missions,
      COALESCE(SUM(m.points_reward), 0)::BIGINT AS total_points
    FROM public.profiles p
    INNER JOIN public.mission_participants mp ON mp.profile_id = p.id
    INNER JOIN public.missions m ON m.id = mp.mission_id AND m.status = 'completed'
    WHERE COALESCE(p.is_active, true) = true
    GROUP BY p.id, p.username, p.albion_character_name
  )
  SELECT
    s.profile_id,
    s.username,
    s.albion_character_name,
    s.completed_missions,
    s.total_points,
    ROW_NUMBER() OVER (
      ORDER BY s.total_points DESC, s.completed_missions DESC, s.username ASC
    ) AS rank
  FROM stats s
  ORDER BY rank
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_completion_ranking(INTEGER) TO anon, authenticated;

-- 6) Ranking fama mensal
DROP FUNCTION IF EXISTS public.get_monthly_fame_ranking(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_monthly_fame_ranking(
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH month AS (
    SELECT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM') AS month_key
  ),
  deltas AS (
    SELECT
      p.id AS profile_id,
      p.username,
      COALESCE(NULLIF(p.albion_character_name, ''), p.username) AS albion_character_name,
      CASE lower(COALESCE(p_category, 'pvp'))
        WHEN 'pvp' THEN GREATEST(0, COALESCE(p.albion_kill_fame, 0) - COALESCE(b.kill_fame, 0))
        WHEN 'pve' THEN GREATEST(0, COALESCE(p.albion_pve_fame, 0) - COALESCE(b.pve_fame, 0))
        WHEN 'gathering' THEN GREATEST(0, COALESCE(p.albion_gathering_fame, 0) - COALESCE(b.gathering_fame, 0))
        ELSE 0
      END AS fame_delta
    FROM public.profiles p
    CROSS JOIN month m
    LEFT JOIN public.profile_fame_baselines b
      ON b.profile_id = p.id AND b.month_key = m.month_key
    WHERE COALESCE(p.is_active, true) = true
  )
  SELECT
    d.profile_id,
    d.username,
    d.albion_character_name,
    d.fame_delta,
    ROW_NUMBER() OVER (ORDER BY d.fame_delta DESC, d.username ASC) AS rank
  FROM deltas d
  WHERE d.fame_delta > 0
  ORDER BY rank
  LIMIT GREATEST(COALESCE(p_limit, 30), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_fame_ranking(TEXT, INTEGER) TO anon, authenticated;

SELECT 'QUICK_FIX_SCHEMA aplicado — recarregue o app' AS status;
