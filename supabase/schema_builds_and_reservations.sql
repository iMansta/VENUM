-- =====================================================================
-- VENUM MARKET - Builds + Transport Reservations schema (consolidated)
-- =====================================================================
-- Este script é IDEMPOTENTE e seguro para aplicar várias vezes. Ele
-- garante que existam no Supabase:
--   * Tabelas: build_categories, builds, transport_reservations
--   * RPCs:    get_build_categories_with_count (público)
--              reserve_transport (atualizado)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) build_categories
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.build_categories (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_build_categories_name ON public.build_categories(name);

ALTER TABLE public.build_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view build categories" ON public.build_categories;
CREATE POLICY "Anyone can view build categories"
  ON public.build_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage build categories" ON public.build_categories;
CREATE POLICY "Admins can manage build categories"
  ON public.build_categories FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---------------------------------------------------------------------
-- 2) builds
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.builds (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.build_categories(id) ON DELETE CASCADE,
  -- O frontend usa tanto `name` quanto `title`. Mantemos `title` como
  -- coluna canônica e geramos `name` via view para retrocompatibilidade.
  title       TEXT NOT NULL,
  name        TEXT GENERATED ALWAYS AS (title) STORED,
  items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  author      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builds_category ON public.builds(category_id);
CREATE INDEX IF NOT EXISTS idx_builds_created_at ON public.builds(created_at DESC);

ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view builds" ON public.builds;
CREATE POLICY "Anyone can view builds"
  ON public.builds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage builds" ON public.builds;
CREATE POLICY "Admins can manage builds"
  ON public.builds FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---------------------------------------------------------------------
-- 3) transport_reservations (sistema de rotas de transporte)
-- ---------------------------------------------------------------------
-- Coexiste com a tabela `transports` existente em schema.sql. Esta nova
-- tabela é específica para o fluxo de "Reserve a Transport Route".
-- O frontend grava nesta tabela via RPC `reserve_transport`.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transport_reservations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id          TEXT NOT NULL,
  item_name        TEXT,
  from_city        TEXT NOT NULL,
  to_city          TEXT NOT NULL DEFAULT 'Caerleon',
  buy_price        NUMERIC NOT NULL DEFAULT 0,
  sell_price       NUMERIC NOT NULL DEFAULT 0,
  profit           NUMERIC NOT NULL DEFAULT 0,
  expected_profit  NUMERIC NOT NULL DEFAULT 0,
  quantity         INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'reserved'
                     CHECK (status IN ('reserved','completed','cancelled','expired')),
  reserved_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reserved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,
  checklist_data   JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tr_item ON public.transport_reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_tr_status ON public.transport_reservations(status);
CREATE INDEX IF NOT EXISTS idx_tr_user ON public.transport_reservations(reserved_by);
CREATE INDEX IF NOT EXISTS idx_tr_expires ON public.transport_reservations(expires_at);

ALTER TABLE public.transport_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view transport reservations" ON public.transport_reservations;
CREATE POLICY "Anyone can view transport reservations"
  ON public.transport_reservations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can reserve transport" ON public.transport_reservations;
CREATE POLICY "Authenticated users can reserve transport"
  ON public.transport_reservations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own reservations" ON public.transport_reservations;
CREATE POLICY "Users can update their own reservations"
  ON public.transport_reservations FOR UPDATE USING (
    reserved_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','officer'))
  );

-- ---------------------------------------------------------------------
-- 4) RPC pública: get_build_categories_with_count
--    Faz JOIN e retorna cada categoria com o número de builds.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_build_categories_with_count()
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ,
  build_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.created_at,
    COALESCE((
      SELECT COUNT(*) FROM public.builds b WHERE b.category_id = c.id
    ), 0)::BIGINT AS build_count
  FROM public.build_categories c
  ORDER BY c.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_build_categories_with_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_build_categories_with_count TO anon;

-- ---------------------------------------------------------------------
-- 5) RPC pública: get_builds_by_category(p_category_id)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_builds_by_category(p_category_id UUID)
RETURNS TABLE (
  id          UUID,
  category_id UUID,
  title       TEXT,
  name        TEXT,
  items       JSONB,
  description TEXT,
  author      TEXT,
  created_at  TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.category_id,
    b.title,
    b.name,
    b.items,
    b.description,
    b.author,
    b.created_at
  FROM public.builds b
  WHERE b.category_id = p_category_id
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_builds_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_builds_by_category TO anon;

-- ---------------------------------------------------------------------
-- 6) RPC admin: admin_create_build_category
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_build_category(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.build_categories (name, description)
  VALUES (p_name, COALESCE(p_description, ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_create_build_category TO authenticated;

-- ---------------------------------------------------------------------
-- 7) RPC admin: admin_update_build_category
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_build_category(
  p_category_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.build_categories
     SET name        = p_name,
         description = COALESCE(p_description, ''),
         created_at  = created_at
   WHERE id = p_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_update_build_category TO authenticated;

-- ---------------------------------------------------------------------
-- 8) RPC admin: admin_delete_build_category
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_build_category(p_category_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.build_categories WHERE id = p_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_delete_build_category TO authenticated;

-- ---------------------------------------------------------------------
-- 9) RPC admin: admin_create_build
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_build(
  p_category_id UUID,
  p_title       TEXT,
  p_items       JSONB DEFAULT '[]'::jsonb,
  p_description TEXT DEFAULT NULL,
  p_author      TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.builds (category_id, title, items, description, author)
  VALUES (p_category_id, p_title, p_items, p_description, p_author)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_create_build TO authenticated;

-- ---------------------------------------------------------------------
-- 10) RPC admin: admin_update_build
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_build(
  p_build_id    UUID,
  p_category_id UUID,
  p_title       TEXT,
  p_items       JSONB DEFAULT '[]'::jsonb,
  p_description TEXT DEFAULT NULL,
  p_author      TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.builds
     SET category_id = p_category_id,
         title        = p_title,
         items        = p_items,
         description  = p_description,
         author       = p_author
   WHERE id = p_build_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_update_build TO authenticated;

-- ---------------------------------------------------------------------
-- 11) RPC admin: admin_delete_build
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_build(p_build_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.builds WHERE id = p_build_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_delete_build TO authenticated;

-- ---------------------------------------------------------------------
-- 12) RPC: reserve_transport (atualizada, idempotente)
--    Grava em transport_reservations. Mantém compat com a função
--    legada em schema.sql — esta versão usa a tabela NOVA.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reserve_transport CASCADE;

CREATE OR REPLACE FUNCTION public.reserve_transport(
  p_item_id        TEXT,
  p_item_name      TEXT            DEFAULT NULL,
  p_from_city      TEXT            DEFAULT NULL,
  p_to_city        TEXT            DEFAULT 'Caerleon',
  p_buy_price      NUMERIC         DEFAULT 0,
  p_sell_price     NUMERIC         DEFAULT 0,
  p_profit         NUMERIC         DEFAULT 0,
  p_expected_profit NUMERIC        DEFAULT 0,
  p_quantity       INTEGER         DEFAULT 1,
  p_reserved_by    UUID            DEFAULT NULL,
  p_expires_at     TIMESTAMPTZ     DEFAULT NULL,
  p_checklist_data JSONB           DEFAULT NULL
)
RETURNS TABLE (
  success      BOOLEAN,
  message      TEXT,
  transport_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      UUID := COALESCE(p_reserved_by, auth.uid());
  v_existing INTEGER;
  v_new_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Usuario nao autenticado.', NULL::UUID;
    RETURN;
  END IF;

  IF p_item_id IS NULL OR LENGTH(TRIM(p_item_id)) = 0 THEN
    RETURN QUERY SELECT FALSE, 'item_id obrigatorio.', NULL::UUID;
    RETURN;
  END IF;

  IF COALESCE(p_quantity, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Quantidade invalida.', NULL::UUID;
    RETURN;
  END IF;

  -- Concurrency check (evita reservas duplicadas na mesma rota)
  SELECT COUNT(*) INTO v_existing
  FROM public.transport_reservations t
  WHERE t.item_id  = p_item_id
    AND t.to_city  = COALESCE(NULLIF(p_to_city, ''), 'Caerleon')
    AND t.status   = 'reserved'
    AND t.expires_at IS NOT NULL
    AND t.expires_at > NOW();

  IF v_existing > 0 THEN
    RETURN QUERY SELECT FALSE,
      'Esta rota ja foi reservada por outro jogador.',
      NULL::UUID;
    RETURN;
  END IF;

  IF p_expires_at IS NULL THEN
    p_expires_at := NOW() + INTERVAL '20 minutes';
  END IF;

  INSERT INTO public.transport_reservations (
    item_id, item_name, from_city, to_city,
    buy_price, sell_price, profit, expected_profit,
    quantity, status, reserved_by, reserved_at,
    expires_at, checklist_data
  )
  VALUES (
    p_item_id,
    COALESCE(NULLIF(p_item_name, ''), p_item_id),
    COALESCE(NULLIF(p_from_city, ''), 'Black Market'),
    COALESCE(NULLIF(p_to_city, ''), 'Caerleon'),
    COALESCE(p_buy_price, 0),
    COALESCE(p_sell_price, 0),
    COALESCE(p_profit, 0),
    COALESCE(p_expected_profit, 0),
    COALESCE(p_quantity, 1),
    'reserved',
    v_uid,
    NOW(),
    p_expires_at,
    p_checklist_data
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT TRUE, 'Reserva criada com sucesso.', v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_transport TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_transport TO anon;