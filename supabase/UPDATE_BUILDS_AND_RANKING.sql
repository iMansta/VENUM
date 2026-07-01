-- =====================================================================
-- VENUM — Builds picker + Ranking de missões
-- Execute APÓS: 00_SCHEMA_BASE.sql → UPDATE_PRODUCTION.sql → UPDATE_PHASE2.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Coluna slot em market_items (se faltar)
-- ---------------------------------------------------------------------
ALTER TABLE public.market_items ADD COLUMN IF NOT EXISTS slot TEXT;
CREATE INDEX IF NOT EXISTS idx_market_items_slot ON public.market_items (slot);

-- ---------------------------------------------------------------------
-- 2) RPC get_items_for_slot (assinatura usada pelo frontend)
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
  subcategory  TEXT,
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
    mi.subcategory,
    mi.name_pt,
    COALESCE(
      mi.image_url,
      'https://render.albiononline.com/v1/item/' || mi.item_id || '.png'
    ) AS image_url
  FROM public.market_items mi
  WHERE (p_slot IS NULL OR mi.slot = p_slot OR (p_slot IS NOT NULL AND mi.slot IS NULL AND mi.family LIKE p_slot || '%'))
    AND (p_tier IS NULL OR mi.tier = p_tier)
    AND mi.enchantment = 0
    AND (
      p_search IS NULL
      OR p_search = ''
      OR mi.name_pt ILIKE '%' || p_search || '%'
      OR mi.item_id ILIKE '%' || p_search || '%'
    )
  ORDER BY mi.family ASC, mi.tier DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_items_for_slot(TEXT, INTEGER, TEXT, INTEGER, INTEGER)
  TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Ranking por missões concluídas (participante + mission status=completed)
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
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
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
      ORDER BY s.completed_missions DESC, s.total_points DESC, s.username ASC
    ) AS rank
  FROM stats s
  ORDER BY rank
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_completion_ranking(INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Membros podem ver missões concluídas (para contexto na UI)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Completed missions are viewable by members" ON public.missions;
CREATE POLICY "Completed missions are viewable by members"
  ON public.missions FOR SELECT
  USING (status = 'completed' OR status = 'active');

SELECT 'UPDATE_BUILDS_AND_RANKING aplicado' AS status;
