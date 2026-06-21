-- =====================================================================
-- VENUM MARKET - Market Settings & Per-Location Cache Refactor
-- =====================================================================
-- This script is idempotent and additive. It does NOT drop or replace
-- the existing market_prices_cache table/functions.
--
-- It introduces:
--   1) public.market_settings  -> single-row config table for MIN_PROFIT
--                                  and MIN_MARGIN_PCT (with safe defaults).
--   2) public.market_prices_cache_by_location -> per (item_id, location)
--                                  cache, exposing item_id, price_data,
--                                  location, cached_at, expires_at.
--
-- Apply this in the Supabase SQL Editor alongside schema.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Market settings (single-row, configurable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_profit    NUMERIC NOT NULL DEFAULT 10000,        -- silver
  min_margin_pct NUMERIC NOT NULL DEFAULT 0.10,        -- 10%
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT market_settings_single_row CHECK (id = 1)
);

-- Seed default row if missing
INSERT INTO public.market_settings (id, min_profit, min_margin_pct)
VALUES (1, 10000, 0.10)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.market_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view market settings" ON public.market_settings;
CREATE POLICY "Anyone can view market settings"
  ON public.market_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update market settings" ON public.market_settings;
CREATE POLICY "Admins can update market settings"
  ON public.market_settings FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to fetch current market settings with sane defaults
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

  -- Fallback if the row is somehow missing
  IF NOT FOUND THEN
    RETURN QUERY SELECT 10000::NUMERIC, 0.10::NUMERIC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_market_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_settings TO anon;

-- ---------------------------------------------------------------------
-- 2) Per-location market prices cache
-- ---------------------------------------------------------------------
-- Each (item_id, location) is stored as its own row, exposing the
-- requested columns: item_id, price (as JSONB), location, timestamp.
-- price_data is JSONB because the Albion API returns an object
-- { buy_price_min, sell_price_min, buy_price_max, sell_price_max, ... }.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_prices_cache_by_location (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id     TEXT NOT NULL,
  location    TEXT NOT NULL,
  price_data  JSONB NOT NULL,
  cached_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  UNIQUE (item_id, location)
);

CREATE INDEX IF NOT EXISTS idx_mpcl_item_id
  ON public.market_prices_cache_by_location(item_id);

CREATE INDEX IF NOT EXISTS idx_mpcl_item_location
  ON public.market_prices_cache_by_location(item_id, location);

CREATE INDEX IF NOT EXISTS idx_mpcl_expires_at
  ON public.market_prices_cache_by_location(expires_at);

ALTER TABLE public.market_prices_cache_by_location ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view market prices cache by location"
  ON public.market_prices_cache_by_location;
CREATE POLICY "Anyone can view market prices cache by location"
  ON public.market_prices_cache_by_location FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can insert market prices cache by location"
  ON public.market_prices_cache_by_location;
CREATE POLICY "System can insert market prices cache by location"
  ON public.market_prices_cache_by_location FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update market prices cache by location"
  ON public.market_prices_cache_by_location;
CREATE POLICY "System can update market prices cache by location"
  ON public.market_prices_cache_by_location FOR UPDATE USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Get cached prices for a list of items across the supported locations.
-- Returns one row per (item_id, location) pair.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cached_market_prices_by_location(
  p_item_ids TEXT[]
)
RETURNS TABLE (
  item_id     TEXT,
  location    TEXT,
  price_data  JSONB,
  cached_at   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mpcl.item_id,
    mpcl.location,
    mpcl.price_data,
    mpcl.cached_at,
    mpcl.expires_at
  FROM public.market_prices_cache_by_location mpcl
  WHERE mpcl.item_id = ANY(p_item_ids)
    AND mpcl.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_cached_market_prices_by_location TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cached_market_prices_by_location TO anon;

-- ---------------------------------------------------------------------
-- Upsert a single (item_id, location) row
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_cached_market_price_by_location(
  p_item_id    TEXT,
  p_location   TEXT,
  p_price_data JSONB
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.market_prices_cache_by_location
    (item_id, location, price_data, cached_at, expires_at)
  VALUES
    (p_item_id, p_location, p_price_data, NOW(), NOW() + INTERVAL '15 minutes')
  ON CONFLICT (item_id, location) DO UPDATE
    SET price_data = EXCLUDED.price_data,
        cached_at  = NOW(),
        expires_at = NOW() + INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_cached_market_price_by_location TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cached_market_price_by_location TO anon;

-- ---------------------------------------------------------------------
-- Clear expired rows from the per-location cache
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_expired_market_cache_by_location()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.market_prices_cache_by_location
  WHERE expires_at <= NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.clear_expired_market_cache_by_location TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_expired_market_cache_by_location TO anon;