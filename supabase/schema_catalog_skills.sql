-- =====================================================================
-- VENUM - Evolução do Catálogo Canônico de Itens (Etapa 1 - CORRIGIDO)
-- =====================================================================
-- Adiciona a VENUM knowledge layer ao market_items:
--   - slot / subcategory (normalização do nome → equipamento real)
--   - image_url (render URL canônica do Albion Online)
--   - active_skills / passive_skills (JSONB)
--
-- Afrouxa os defaults do market_settings para destravar o pipeline de
-- arbitragem (min_profit=100, min_margin_pct=0.02).
--
-- Cria duas RPCs:
--   - get_item_with_skills(item_id)   -> leitura rica (catálogo + skills)
--   - get_items_for_slot(slot, tier)  -> listagem paginada por slot
--   - upsert_market_items_full(arr)   -> upsert em lote estendido
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Colunas novas no catálogo (Venum knowledge layer)
-- ---------------------------------------------------------------------
ALTER TABLE public.market_items
  ADD COLUMN IF NOT EXISTS subcategory    TEXT,
  ADD COLUMN IF NOT EXISTS slot           TEXT,
  ADD COLUMN IF NOT EXISTS image_url      TEXT,
  ADD COLUMN IF NOT EXISTS active_skills  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS passive_skills JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_market_items_slot
  ON public.market_items (slot);
CREATE INDEX IF NOT EXISTS idx_market_items_subcategory
  ON public.market_items (subcategory);
CREATE INDEX IF NOT EXISTS idx_market_items_active_skills_gin
  ON public.market_items USING GIN (active_skills);
CREATE INDEX IF NOT EXISTS idx_market_items_passive_skills_gin
  ON public.market_items USING GIN (passive_skills);

COMMENT ON COLUMN public.market_items.subcategory IS
  'Subcategoria visual: cloth_armor, leather_armor, plate_armor, sword, axe, bow, ...';
COMMENT ON COLUMN public.market_items.slot IS
  'Slot de equipamento: MAIN_HAND, OFF_HAND, HEAD, ARMOR, SHOES, CAPE, BAG, FOOD, POTION, MOUNT, TRINKET';
COMMENT ON COLUMN public.market_items.image_url IS
  'URL canônica do render do item (https://render.albiononline.com/v1/item/<item_id>.png)';
COMMENT ON COLUMN public.market_items.active_skills IS
  'Array JSONB de habilidades ativas: [{key:"Q", name_pt:"...", description_pt:"..."}]';
COMMENT ON COLUMN public.market_items.passive_skills IS
  'Array JSONB de habilidades passivas: [{key:"P1", name_pt:"..."}]';

-- ---------------------------------------------------------------------
-- 2) Reforço do índice composto do cache dinâmico
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mpcl_item_location_expires
  ON public.market_prices_cache_by_location (item_id, location, expires_at);

-- ---------------------------------------------------------------------
-- 3) Afrouxamento dos thresholds (destrava o pipeline de arbitragem)
-- ---------------------------------------------------------------------
UPDATE public.market_settings
   SET min_profit = 100,
       min_margin_pct = 0.02,
       updated_at = NOW()
 WHERE id = 1;

ALTER TABLE public.market_settings
  ADD COLUMN IF NOT EXISTS show_marginal_opportunities BOOLEAN NOT NULL DEFAULT FALSE;

-- Remoção preventiva para evitar conflito de assinaturas
DROP FUNCTION IF EXISTS public.get_market_settings();

CREATE OR REPLACE FUNCTION public.get_market_settings()
RETURNS TABLE (
  min_profit     NUMERIC,
  min_margin_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT ms.min_profit, ms.min_margin_pct
  FROM public.market_settings ms
  WHERE ms.id = 1;

  IF NOT FOUND THEN
    INSERT INTO public.market_settings (id, min_profit, min_margin_pct)
    VALUES (1, 100, 0.02)
    ON CONFLICT (id) DO NOTHING;
    RETURN QUERY SELECT 100::NUMERIC, 0.02::NUMERIC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_market_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_settings() TO anon;

-- ---------------------------------------------------------------------
-- 4) RPC: get_item_with_skills
-- ---------------------------------------------------------------------
-- Remove versões anteriores com a mesma assinatura para garantir unicidade
DROP FUNCTION IF EXISTS public.get_item_with_skills(TEXT);

CREATE OR REPLACE FUNCTION public.get_item_with_skills(p_item_id TEXT)
RETURNS TABLE (
  item_id        TEXT,
  tier           INTEGER,
  enchantment    INTEGER,
  family         TEXT,
  category       TEXT,
  subcategory    TEXT,
  slot           TEXT,
  name_pt        TEXT,
  image_url      TEXT,
  active_skills  JSONB,
  passive_skills JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    mi.item_id, mi.tier, mi.enchantment, mi.family, mi.category,
    mi.subcategory, mi.slot, mi.name_pt, mi.image_url,
    mi.active_skills, mi.passive_skills
  FROM public.market_items mi
  WHERE mi.item_id = p_item_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_item_with_skills(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) RPC: get_items_for_slot (Causa raiz do erro 42725 resolvida)
-- ---------------------------------------------------------------------
-- Remove todas as variações antigas possíveis desta função do banco
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT);
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.get_items_for_slot(TEXT, INTEGER, TEXT, INTEGER, INTEGER);

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
    mi.item_id, mi.tier, mi.enchantment, mi.family, mi.category,
    mi.subcategory, mi.name_pt, mi.image_url
  FROM public.market_items mi
  WHERE mi.slot = p_slot
    AND (p_tier IS NULL OR mi.tier = p_tier)
    AND mi.enchantment = 0
    AND (
      p_search IS NULL
      OR mi.name_pt ILIKE '%' || p_search || '%'
      OR mi.item_id ILIKE '%' || p_search || '%'
    )
  ORDER BY mi.family ASC, mi.tier DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
$$;

-- Informa explicitamente os tipos dos argumentos no GRANT para evitar ambiguidade
GRANT EXECUTE ON FUNCTION public.get_items_for_slot(TEXT, INTEGER, TEXT, INTEGER, INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) RPC: upsert_market_items_full
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_market_items_full(JSONB);

CREATE OR REPLACE FUNCTION public.upsert_market_items_full(p_items JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := 0;
  v_item  JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.market_items (
      item_id, tier, enchantment, family, category, subcategory, slot,
      name_pt, image_url, active_skills, passive_skills, updated_at
    ) VALUES (
      v_item->>'item_id',
      (v_item->>'tier')::INTEGER,
      COALESCE((v_item->>'enchantment')::INTEGER, 0),
      v_item->>'family',
      v_item->>'category',
      v_item->>'subcategory',
      v_item->>'slot',
      v_item->>'name_pt',
      v_item->>'image_url',
      COALESCE((v_item->'active_skills')::jsonb, '[]'::jsonb),
      COALESCE((v_item->'passive_skills')::jsonb, '[]'::jsonb),
      NOW()
    )
    ON CONFLICT (item_id) DO UPDATE
      SET tier            = EXCLUDED.tier,
          enchantment     = EXCLUDED.enchantment,
          family          = EXCLUDED.family,
          category        = EXCLUDED.category,
          subcategory     = EXCLUDED.subcategory,
          slot            = EXCLUDED.slot,
          name_pt         = EXCLUDED.name_pt,
          image_url       = EXCLUDED.image_url,
          active_skills   = EXCLUDED.active_skills,
          passive_skills  = EXCLUDED.passive_skills,
          updated_at      = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_market_items_full(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_market_items_full(JSONB) TO authenticated;

-- ---------------------------------------------------------------------
-- 7) Backfill de slot e image_url para itens que JÁ existem
-- ---------------------------------------------------------------------
UPDATE public.market_items
   SET slot = CASE
     WHEN item_id LIKE '%_BAG'      THEN 'BAG'
     WHEN item_id LIKE '%_CAPE'     THEN 'CAPE'
     WHEN item_id LIKE 'T%_HEAD_%'  THEN 'HEAD'
     WHEN item_id LIKE 'T%_ARMOR_%' THEN 'ARMOR'
     WHEN item_id LIKE 'T%_SHOES_%' THEN 'SHOES'
     WHEN item_id LIKE 'T%_MAIN_%'  THEN 'MAIN_HAND'
     WHEN item_id LIKE 'T%_OFF_%'   THEN 'OFF_HAND'
     WHEN item_id LIKE '%_SHIELD'   THEN 'OFF_HAND'
     WHEN item_id LIKE 'T%_FOOD'    THEN 'FOOD'
     WHEN item_id LIKE 'T%_POTION'  THEN 'POTION'
     WHEN item_id LIKE 'T%_MOUNT'   THEN 'MOUNT'
     ELSE slot
   END
 WHERE slot IS NULL;

UPDATE public.market_items
   SET image_url = 'https://render.albiononline.com/v1/item/' || item_id || '.png'
 WHERE image_url IS NULL;