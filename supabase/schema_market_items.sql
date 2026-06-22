-- =====================================================================
-- VENUM MARKET - Catálogo de itens do Albian Online (market_items)
-- =====================================================================
-- Esta migration cria a tabela `market_items` que armazena APENAS o
-- catálogo (nome, item_id, categoria, tier, encantamento). Os preços
-- continuam sendo cacheados em `market_prices_cache_by_location`.
--
-- O frontend usa essa tabela para evitar de depender da API externa
-- toda vez que precisa listar quais itens existem — a API agora só
-- é consultada para atualizar o preço de itens que mudaram.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.market_items (
    item_id      TEXT PRIMARY KEY,
    tier         INTEGER NOT NULL CHECK (tier BETWEEN 2 AND 8),
    enchantment  INTEGER NOT NULL DEFAULT 0 CHECK (enchantment BETWEEN 0 AND 3),
    family       TEXT NOT NULL,        -- ex: MAIN_SWORD, HEAD_CLOTH
    category     TEXT NOT NULL,        -- equipment, consumable, etc.
    name_pt      TEXT,                 -- nome traduzido em PT-BR (preenchido opcionalmente)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_items_category   ON public.market_items(category);
CREATE INDEX IF NOT EXISTS idx_market_items_tier      ON public.market_items(tier);
CREATE INDEX IF NOT EXISTS idx_market_items_family    ON public.market_items(family);
CREATE INDEX IF NOT EXISTS idx_market_items_enchant   ON public.market_items(enchantment);
CREATE INDEX IF NOT EXISTS idx_market_items_updated   ON public.market_items(updated_at);

ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view market items" ON public.market_items;
CREATE POLICY "Anyone can view market items"
    ON public.market_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can upsert market items" ON public.market_items;
CREATE POLICY "System can upsert market items"
    ON public.market_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update market items" ON public.market_items;
CREATE POLICY "System can update market items"
    ON public.market_items FOR UPDATE USING (true);

-- ---------------------------------------------------------------------
-- RPC: get_market_items_catalog
--   Retorna o catálogo paginado + filtrado por tier/family.
--   Default = só itens base (encantamento 0) para UX limpa.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_market_items_catalog(
    p_tier       INTEGER DEFAULT NULL,
    p_family     TEXT    DEFAULT NULL,
    p_category   TEXT    DEFAULT NULL,
    p_base_only  BOOLEAN DEFAULT TRUE,
    p_limit      INTEGER DEFAULT 500
)
RETURNS TABLE (
    item_id      TEXT,
    tier         INTEGER,
    enchantment  INTEGER,
    family       TEXT,
    category     TEXT,
    name_pt      TEXT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        mi.item_id,
        mi.tier,
        mi.enchantment,
        mi.family,
        mi.category,
        mi.name_pt
    FROM public.market_items mi
    WHERE (p_tier IS NULL OR mi.tier = p_tier)
      AND (p_family IS NULL OR mi.family = p_family)
      AND (p_category IS NULL OR mi.category = p_category)
      AND (NOT p_base_only OR mi.enchantment = 0)
    ORDER BY mi.tier DESC, mi.family ASC, mi.enchantment ASC
    LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_market_items_catalog TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_items_catalog TO anon;

-- ---------------------------------------------------------------------
-- RPC: upsert_market_items
--   Inserção em massa a partir de uma lista JSONB.
--   Usado pelo frontend para popular a tabela na primeira vez e
--   em sincronizações subsequentes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_market_items(
    p_items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_item JSONB;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RETURN 0;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.market_items (
            item_id, tier, enchantment, family, category, name_pt, updated_at
        )
        VALUES (
            v_item->>'item_id',
            (v_item->>'tier')::INTEGER,
            COALESCE((v_item->>'enchantment')::INTEGER, 0),
            v_item->>'family',
            v_item->>'category',
            v_item->>'name_pt',
            NOW()
        )
        ON CONFLICT (item_id) DO UPDATE
        SET tier         = EXCLUDED.tier,
            enchantment  = EXCLUDED.enchantment,
            family       = EXCLUDED.family,
            category     = EXCLUDED.category,
            name_pt      = EXCLUDED.name_pt,
            updated_at   = NOW();

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_market_items TO authenticated;

-- ---------------------------------------------------------------------
-- View: v_market_items_base_only
--   Apenas itens com encantamento 0 (versão base) para UX limpa do
--   construtor de builds.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_market_items_base_only AS
    SELECT item_id, tier, enchantment, family, category, name_pt
    FROM public.market_items
    WHERE enchantment = 0;

GRANT SELECT ON public.v_market_items_base_only TO authenticated;
GRANT SELECT ON public.v_market_items_base_only TO anon;