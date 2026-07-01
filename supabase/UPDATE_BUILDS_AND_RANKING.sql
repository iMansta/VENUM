-- =====================================================================
-- VENUM — Builds picker + Rankings + Fame mensal + Market settings fix
-- Execute APÓS: 00_SCHEMA_BASE → UPDATE_PRODUCTION → UPDATE_PHASE2
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Colunas extras em market_items (seguro se já existirem)
-- ---------------------------------------------------------------------
ALTER TABLE public.market_items ADD COLUMN IF NOT EXISTS slot TEXT;
ALTER TABLE public.market_items ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.market_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.market_items ADD COLUMN IF NOT EXISTS active_skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.market_items ADD COLUMN IF NOT EXISTS passive_skills JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_market_items_slot ON public.market_items (slot);

-- ---------------------------------------------------------------------
-- 2) Fame no perfil + baseline mensal (PvP / PvE / Coleta)
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_kill_fame BIGINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_pve_fame BIGINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_gathering_fame BIGINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_fame_synced_at TIMESTAMPTZ;

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

CREATE INDEX IF NOT EXISTS idx_fame_baselines_month ON public.profile_fame_baselines (month_key);

ALTER TABLE public.profile_fame_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view fame baselines" ON public.profile_fame_baselines;
CREATE POLICY "Members can view fame baselines"
  ON public.profile_fame_baselines FOR SELECT USING (true);

-- ---------------------------------------------------------------------
-- 3) Fix get_market_settings (evita erro 400 de tipo incompatível)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 4) RPC get_items_for_slot (sem depender de subcategory existir)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT);
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT, INTEGER, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_items_for_slot(
  p_slot    TEXT,
  p_tier    INTEGER DEFAULT 8,
  p_search  TEXT    DEFAULT NULL,
  p_limit   INTEGER DEFAULT 50,
  p_offset  INTEGER DEFAULT 0
)
RETURNS TABLE (
  item_id      TEXT,
  tier         INTEGER,
  enchantment  INTEGER,
  family       TEXT,
  category     TEXT,
  name_pt      TEXT,
  image_url    TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    mi.item_id,
    mi.tier,
    mi.enchantment,
    mi.family,
    mi.category,
    COALESCE(mi.name_pt, mi.item_id) AS name_pt,
    COALESCE(
      mi.image_url,
      'https://render.albiononline.com/v1/item/' || mi.item_id || '.png'
    ) AS image_url
  FROM public.market_items mi
  WHERE mi.enchantment = 0
    AND (p_tier IS NULL OR mi.tier = p_tier)
    AND (
      p_slot IS NULL
      OR mi.slot = p_slot
      OR (mi.slot IS NULL AND mi.family LIKE (
        CASE p_slot
          WHEN 'MAIN_HAND' THEN 'MAIN_%'
          WHEN 'OFF_HAND'  THEN 'OFF_%'
          WHEN 'HEAD'      THEN 'HEAD_%'
          WHEN 'ARMOR'     THEN 'ARMOR_%'
          WHEN 'SHOES'     THEN 'SHOES_%'
          ELSE p_slot || '%'
        END
      ))
    )
    AND (
      p_search IS NULL OR p_search = ''
      OR mi.name_pt ILIKE '%' || p_search || '%'
      OR mi.item_id ILIKE '%' || p_search || '%'
      OR mi.family ILIKE '%' || p_search || '%'
    )
  ORDER BY mi.family ASC, mi.tier DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_items_for_slot(TEXT, INTEGER, TEXT, INTEGER, INTEGER)
  TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) RPC get_item_with_skills (passivas / ativas do catálogo)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_item_with_skills(TEXT);

CREATE OR REPLACE FUNCTION public.get_item_with_skills(p_item_id TEXT)
RETURNS TABLE (
  item_id TEXT,
  name_pt TEXT,
  tier INTEGER,
  family TEXT,
  slot TEXT,
  image_url TEXT,
  active_skills JSONB,
  passive_skills JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    mi.item_id,
    COALESCE(mi.name_pt, mi.item_id),
    mi.tier,
    mi.family,
    mi.slot,
    COALESCE(mi.image_url, 'https://render.albiononline.com/v1/item/' || mi.item_id || '.png'),
    COALESCE(mi.active_skills, '[]'::jsonb),
    COALESCE(mi.passive_skills, '[]'::jsonb)
  FROM public.market_items mi
  WHERE mi.item_id = p_item_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_item_with_skills(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) Ranking missões (pontos da guilda na aplicação)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 7) Ranking fama mensal (pvp | pve | gathering)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 8) Missões concluídas visíveis aos membros
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Completed missions are viewable by members" ON public.missions;
CREATE POLICY "Completed missions are viewable by members"
  ON public.missions FOR SELECT
  USING (status IN ('completed', 'active'));

SELECT 'UPDATE_BUILDS_AND_RANKING aplicado' AS status;
