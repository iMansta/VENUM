-- =====================================================================
-- VENUM — RLS Hardening & Builds Item Catalog
-- =====================================================================
-- Idempotent: safe to run multiple times.
-- Goals:
--   1) Fix Supabase Lint "RLS Disabled in Public" warnings.
--   2) Replace permissive WITH CHECK (true) policies with strict ones.
--   3) Expose only the minimum surface area via PostgREST.
--   4) Provide a single catalog view that hydrates builds.items_json
--      with the market_items reference data (idempotent, read-only).
--
-- Run in Supabase SQL Editor.
-- =====================================================================

-- =====================================================================
-- 1) HARDEN RLS FOR: public.market_prices_cache_by_location
-- =====================================================================
-- This is a server-side cache written only by SECURITY DEFINER RPCs
-- (set_cached_market_price_by_location, clear_expired_market_cache_by_location).
-- Direct INSERT/UPDATE/DELETE from anon/authenticated must be blocked.
-- Only SELECT is exposed to the PostgREST API.
-- =====================================================================

ALTER TABLE public.market_prices_cache_by_location ENABLE ROW LEVEL SECURITY;

-- Drop ALL old policies on the table (idempotent)
DO $$
DECLARE p TEXT;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'market_prices_cache_by_location'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.market_prices_cache_by_location', p);
  END LOOP;
END$$;

-- SELECT: public (anon + authenticated)
CREATE POLICY "mpcl_select_public"
  ON public.market_prices_cache_by_location
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: only the table owner / service_role can write.
-- The RPC functions (set_cached_market_price_by_location, ...) run as
-- SECURITY DEFINER and bypass RLS. We do NOT create INSERT/UPDATE/DELETE
-- policies for anon/authenticated, which means they are denied by default.

-- Revoke direct write grants from the PostgREST roles.
REVOKE INSERT, UPDATE, DELETE ON public.market_prices_cache_by_location FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.market_prices_cache_by_location FROM authenticated;
GRANT  SELECT                         ON public.market_prices_cache_by_location TO anon, authenticated;

-- =====================================================================
-- 2) HARDEN RLS FOR: public.market_items
-- =====================================================================
-- market_items is the public reference catalog. SELECT is public.
-- Writes must happen exclusively through the SECURITY DEFINER RPC
-- upsert_market_items(...), not via direct INSERT/UPDATE.
-- =====================================================================

ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p TEXT;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'market_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.market_items', p);
  END LOOP;
END$$;

CREATE POLICY "market_items_select_public"
  ON public.market_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.market_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.market_items FROM authenticated;
GRANT  SELECT                         ON public.market_items TO anon, authenticated;

-- =====================================================================
-- 3) HARDEN RLS FOR: public.market_settings
-- =====================================================================
-- SELECT is public (settings page shows min_profit/min_margin_pct).
-- UPDATE only admins (role = 'admin' in public.profiles).
-- =====================================================================

ALTER TABLE public.market_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p TEXT;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'market_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.market_settings', p);
  END LOOP;
END$$;

CREATE POLICY "market_settings_select_public"
  ON public.market_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "market_settings_admin_update"
  ON public.market_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

REVOKE INSERT, UPDATE, DELETE ON public.market_settings FROM anon;
GRANT  SELECT, UPDATE                  ON public.market_settings TO authenticated;

-- =====================================================================
-- 4) HARDEN RLS FOR: public.builds
-- =====================================================================
-- SELECT: any authenticated user can read builds.
-- INSERT/UPDATE/DELETE: only admins.
-- =====================================================================

ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p TEXT;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'builds'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.builds', p);
  END LOOP;
END$$;

CREATE POLICY "builds_select_authenticated"
  ON public.builds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "builds_admin_write"
  ON public.builds
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

REVOKE ALL ON public.builds FROM anon;
GRANT  SELECT ON public.builds TO authenticated;

-- =====================================================================
-- 5) HARDEN RLS FOR: public.build_categories
-- =====================================================================

ALTER TABLE public.build_categories ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p TEXT;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'build_categories'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.build_categories', p);
  END LOOP;
END$$;

CREATE POLICY "build_categories_select_authenticated"
  ON public.build_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "build_categories_admin_write"
  ON public.build_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

REVOKE ALL ON public.build_categories FROM anon;
GRANT  SELECT ON public.build_categories TO authenticated;

-- =====================================================================
-- 6) VIEW: v_builds_item_catalog
-- =====================================================================
-- Hydrated read-only view that joins builds.items_json (which is a
-- JSONB array of {item_id, slot, ...}) with market_items to give the
-- frontend a single read endpoint for the Build Builder UI.
--
-- Note: We assume builds.items_json is an array of objects like:
--   { "slot": "MAIN_HAND", "item_id": "T6_2H_SWORD", "tier": 6 }
-- If the column uses a different name, adjust the JSON paths below.
-- =====================================================================

CREATE OR REPLACE VIEW public.v_builds_item_catalog AS
SELECT
    b.id                                                       AS build_id,
    b.title                                                    AS build_title,
    b.category_id,
    b.tactics,
    b.author,
    b.created_at                                               AS build_created_at,
    b.updated_at                                               AS build_updated_at,
    mi.item_id,
    mi.tier,
    mi.enchantment,
    mi.family,
    mi.category                                                AS item_category,
    mi.name_pt                                                 AS item_name_pt
FROM public.builds b
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(b.items_json) = 'array' THEN b.items_json
      ELSE '[]'::jsonb
    END
) AS slot ON TRUE
LEFT JOIN public.market_items mi
       ON mi.item_id = (slot.value ->> 'item_id');

COMMENT ON VIEW public.v_builds_item_catalog IS
  'Read-only catalog view: 1 row per (build, item) with hydrated market_items data.';

GRANT SELECT ON public.v_builds_item_catalog TO authenticated;
GRANT SELECT ON public.v_builds_item_catalog TO anon;

-- =====================================================================
-- 7) RPC: get_builds_item_catalog
-- =====================================================================
-- Same as the view but with optional filters and a stable signature.
-- Use this from the frontend (PostgREST: /rest/v1/rpc/get_builds_item_catalog).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_builds_item_catalog(
    p_build_id   UUID    DEFAULT NULL,
    p_category   TEXT    DEFAULT NULL,
    p_family     TEXT    DEFAULT NULL,
    p_tier       INTEGER DEFAULT NULL
)
RETURNS TABLE (
    build_id          UUID,
    build_title       TEXT,
    category_id       UUID,
    tactics           TEXT,
    author            TEXT,
    build_created_at  TIMESTAMPTZ,
    build_updated_at  TIMESTAMPTZ,
    item_id           TEXT,
    tier              INTEGER,
    enchantment       INTEGER,
    family            TEXT,
    item_category     TEXT,
    item_name_pt      TEXT
)
LANGUAGE sql STABLE
SECURITY INVOKER
AS $$
    SELECT
        v.build_id,
        v.build_title,
        v.category_id,
        v.tactics,
        v.author,
        v.build_created_at,
        v.build_updated_at,
        v.item_id,
        v.tier,
        v.enchantment,
        v.family,
        v.item_category,
        v.item_name_pt
    FROM public.v_builds_item_catalog v
    WHERE (p_build_id IS NULL OR v.build_id = p_build_id)
      AND (p_category IS NULL OR v.item_category = p_category)
      AND (p_family   IS NULL OR v.family        = p_family)
      AND (p_tier     IS NULL OR v.tier          = p_tier)
    ORDER BY v.build_updated_at DESC, v.build_id, v.tier DESC, v.family;
$$;

GRANT EXECUTE ON FUNCTION public.get_builds_item_catalog TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_builds_item_catalog TO anon;

-- =====================================================================
-- 8) RPC: get_item_catalog_for_builds
-- =====================================================================
-- Convenience RPC for the Build Builder: returns the item catalog
-- (market_items) filtered by slot → category/family mapping.
-- Slot mapping (frontend convention → market_items.family/category):
--   MAIN_HAND     -> category IN ('weapon','magic','ranged')   (filtra no client)
--   OFF_HAND      -> category = 'weapon' AND family LIKE '2H_OFF%'  OR category='shield'
--   HEAD          -> category = 'armor'  AND family LIKE 'HEAD%'
--   CHEST         -> category = 'armor'  AND family LIKE 'ARMOR%'
--   SHOES         -> category = 'armor'  AND family LIKE 'SHOES%'
--   CAPE          -> category = 'armor'  AND family LIKE 'CAPE%'
--   MOUNT         -> category = 'mount'
--   BAG           -> category = 'bag'
--   POTION        -> category = 'consumable' AND family LIKE 'POTION%'
--   FOOD          -> category = 'consumable' AND family LIKE 'MEAL%'
-- The frontend may filter further; this RPC just returns the union.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_item_catalog_for_builds(
    p_tier     INTEGER DEFAULT NULL,
    p_base_only BOOLEAN DEFAULT TRUE
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
SECURITY INVOKER
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
      AND (NOT p_base_only OR mi.enchantment = 0)
    ORDER BY mi.category, mi.family, mi.tier DESC, mi.enchantment;
$$;

GRANT EXECUTE ON FUNCTION public.get_item_catalog_for_builds TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_item_catalog_for_builds TO anon;

-- =====================================================================
-- 9) SANITY CHECK QUERIES (run manually to verify)
-- =====================================================================
-- SELECT relname, relrowsecurity, relforcerowsecurity
--   FROM pg_class
--  WHERE relname IN (
--    'market_prices_cache_by_location',
--    'market_items',
--    'market_settings',
--    'builds',
--    'build_categories'
--  );
--
-- SELECT schemaname, tablename, policyname, roles, cmd
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename  IN (
--      'market_prices_cache_by_location',
--      'market_items',
--      'market_settings',
--      'builds',
--      'build_categories'
--    )
--  ORDER BY tablename, policyname;
-- =====================================================================