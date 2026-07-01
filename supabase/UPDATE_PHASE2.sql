-- =====================================================================
-- VENUM MARKET — Fase 2: Guilda, Catálogo, Discord, Coletor
-- Execute APÓS UPDATE_PRODUCTION.sql no Supabase SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Campos de perfil — nickname Albion + verificação diária
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS albion_character_name TEXT,
  ADD COLUMN IF NOT EXISTS albion_player_id TEXT,
  ADD COLUMN IF NOT EXISTS guild_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_guild_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_albion_name
  ON public.profiles (lower(albion_character_name));

-- ---------------------------------------------------------------------
-- 2) Missões → flag Discord
-- ---------------------------------------------------------------------
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS discord_notified BOOLEAN DEFAULT false;

-- ---------------------------------------------------------------------
-- 3) Log de atividades (coletor GameInfo → missões futuras)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_event_id TEXT NOT NULL UNIQUE,
  activity_type TEXT NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guild_name TEXT DEFAULT 'I V E N U M I',
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_activity_type ON public.guild_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_guild_activity_created ON public.guild_activity_log(created_at DESC);

ALTER TABLE public.guild_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Officers view activity log" ON public.guild_activity_log;
CREATE POLICY "Officers view activity log"
  ON public.guild_activity_log FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

DROP POLICY IF EXISTS "Service insert activity log" ON public.guild_activity_log;
CREATE POLICY "Service insert activity log"
  ON public.guild_activity_log FOR INSERT WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 4) Catálogo market_items (se ainda não existir)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_items (
  item_id TEXT PRIMARY KEY,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 2 AND 8),
  enchantment INTEGER NOT NULL DEFAULT 0 CHECK (enchantment BETWEEN 0 AND 3),
  family TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'equipment',
  name_pt TEXT,
  slot TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_items_tier ON public.market_items(tier);
CREATE INDEX IF NOT EXISTS idx_market_items_family ON public.market_items(family);

ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view market items" ON public.market_items;
CREATE POLICY "Anyone can view market items"
  ON public.market_items FOR SELECT USING (true);

-- ---------------------------------------------------------------------
-- 5) RPC: IDs do catálogo para arbitragem (mercado consulta só preços)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_arbitrage_catalog_item_ids(
  p_min_tier INTEGER DEFAULT 4,
  p_max_tier INTEGER DEFAULT 8,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (item_id TEXT)
LANGUAGE sql STABLE
AS $$
  SELECT mi.item_id
  FROM public.market_items mi
  WHERE mi.tier >= COALESCE(p_min_tier, 4)
    AND mi.tier <= COALESCE(p_max_tier, 8)
    AND mi.category IN ('equipment', 'weapon', 'armor', 'accessory')
  ORDER BY mi.tier DESC, mi.family ASC, mi.enchantment ASC
  LIMIT GREATEST(COALESCE(p_limit, 500), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_arbitrage_catalog_item_ids TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 6) RPC upsert catálogo (seed-catalog.js)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_market_items_full(p_items JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.market_items (
      item_id, tier, enchantment, family, category, name_pt, slot, image_url, updated_at
    ) VALUES (
      v_item->>'item_id',
      (v_item->>'tier')::INTEGER,
      COALESCE((v_item->>'enchantment')::INTEGER, 0),
      v_item->>'family',
      COALESCE(v_item->>'category', 'equipment'),
      v_item->>'name_pt',
      v_item->>'slot',
      v_item->>'image_url',
      NOW()
    )
    ON CONFLICT (item_id) DO UPDATE SET
      name_pt = EXCLUDED.name_pt,
      slot = EXCLUDED.slot,
      image_url = EXCLUDED.image_url,
      updated_at = NOW();
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_market_items_full TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 7) Sync diário de guilda (pode ser chamado pelo coletor via service role)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deactivate_profile(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET is_active = false, guild_verified = false, last_guild_verified_at = NOW()
  WHERE id = p_profile_id AND role <> 'admin';
END;
$$;

-- ---------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('albion_character_name', 'guild_verified', 'last_guild_verified_at');

SELECT 'get_arbitrage_catalog_item_ids' AS fn,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_arbitrage_catalog_item_ids'
  ) AS ok;
