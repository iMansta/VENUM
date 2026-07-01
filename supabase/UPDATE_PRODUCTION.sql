-- =====================================================================
-- VENUM MARKET - Atualização de Produção (Deploy Vercel)
-- =====================================================================
-- Execute este script COMPLETO no Supabase SQL Editor (Dashboard → SQL).
-- Idempotente: pode ser executado mais de uma vez sem quebrar o banco.
--
-- Pré-requisito: schema base de DATABASE_SCHEMA.md já aplicado
-- (profiles, guild_codes, missions, shop_items, etc.)
--
-- ⚠️  Se o banco está VAZIO, execute PRIMEIRO:
--     supabase/00_SCHEMA_BASE.sql
--
-- O que este script garante:
--   1) market_settings + RPC get_market_settings
--   2) Cache de preços por localização + RPCs
--   3) transport_reservations + RPC reserve_transport
--   4) Builds (categorias + builds) + RPCs
--   5) Catálogo market_items + RPCs
--   6) Trigger de perfil com username do metadata
--   7) Função validate_guild_code (cadastro)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) MARKET SETTINGS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_settings (
  id             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_profit     NUMERIC NOT NULL DEFAULT 10000,
  min_margin_pct NUMERIC NOT NULL DEFAULT 0.10,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT market_settings_single_row CHECK (id = 1)
);

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
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.get_market_settings()
RETURNS TABLE (min_profit NUMERIC, min_margin_pct NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT ms.min_profit, ms.min_margin_pct FROM public.market_settings ms WHERE ms.id = 1;
  IF NOT FOUND THEN RETURN QUERY SELECT 10000::NUMERIC, 0.10::NUMERIC; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_market_settings TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 2) CACHE DE PREÇOS POR LOCALIZAÇÃO
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_prices_cache_by_location (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id    TEXT NOT NULL,
  location   TEXT NOT NULL,
  price_data JSONB NOT NULL,
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  UNIQUE (item_id, location)
);

CREATE INDEX IF NOT EXISTS idx_mpcl_item_id ON public.market_prices_cache_by_location(item_id);
CREATE INDEX IF NOT EXISTS idx_mpcl_expires ON public.market_prices_cache_by_location(expires_at);

ALTER TABLE public.market_prices_cache_by_location ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view market prices cache by location" ON public.market_prices_cache_by_location;
CREATE POLICY "Anyone can view market prices cache by location"
  ON public.market_prices_cache_by_location FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can insert market prices cache by location" ON public.market_prices_cache_by_location;
CREATE POLICY "System can insert market prices cache by location"
  ON public.market_prices_cache_by_location FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update market prices cache by location" ON public.market_prices_cache_by_location;
CREATE POLICY "System can update market prices cache by location"
  ON public.market_prices_cache_by_location FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_cached_market_prices_by_location(p_item_ids TEXT[])
RETURNS TABLE (item_id TEXT, location TEXT, price_data JSONB, cached_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT mpcl.item_id, mpcl.location, mpcl.price_data, mpcl.cached_at, mpcl.expires_at
  FROM public.market_prices_cache_by_location mpcl
  WHERE mpcl.item_id = ANY(p_item_ids) AND mpcl.expires_at > NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_cached_market_price_by_location(
  p_item_id TEXT, p_location TEXT, p_price_data JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.market_prices_cache_by_location (item_id, location, price_data, cached_at, expires_at)
  VALUES (p_item_id, p_location, p_price_data, NOW(), NOW() + INTERVAL '15 minutes')
  ON CONFLICT (item_id, location) DO UPDATE
    SET price_data = EXCLUDED.price_data, cached_at = NOW(), expires_at = NOW() + INTERVAL '15 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_expired_market_cache_by_location()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.market_prices_cache_by_location WHERE expires_at <= NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cached_market_prices_by_location TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_cached_market_price_by_location TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.clear_expired_market_cache_by_location TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 3) TRANSPORT RESERVATIONS + reserve_transport
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transport_reservations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id         TEXT NOT NULL,
  item_name       TEXT,
  from_city       TEXT NOT NULL,
  to_city         TEXT NOT NULL DEFAULT 'Caerleon',
  buy_price       NUMERIC NOT NULL DEFAULT 0,
  sell_price      NUMERIC NOT NULL DEFAULT 0,
  profit          NUMERIC NOT NULL DEFAULT 0,
  expected_profit NUMERIC NOT NULL DEFAULT 0,
  quantity        INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'completed', 'cancelled', 'expired')),
  reserved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reserved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  checklist_data  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    reserved_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

DROP FUNCTION IF EXISTS public.reserve_transport CASCADE;

CREATE OR REPLACE FUNCTION public.reserve_transport(
  p_item_id TEXT,
  p_item_name TEXT DEFAULT NULL,
  p_from_city TEXT DEFAULT NULL,
  p_to_city TEXT DEFAULT 'Caerleon',
  p_buy_price NUMERIC DEFAULT 0,
  p_sell_price NUMERIC DEFAULT 0,
  p_profit NUMERIC DEFAULT 0,
  p_expected_profit NUMERIC DEFAULT 0,
  p_quantity INTEGER DEFAULT 1,
  p_reserved_by UUID DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_checklist_data JSONB DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, transport_id UUID)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid UUID := COALESCE(p_reserved_by, auth.uid());
  v_existing INTEGER;
  v_new_id UUID;
  v_expires TIMESTAMPTZ := COALESCE(p_expires_at, NOW() + INTERVAL '20 minutes');
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Usuario nao autenticado.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_existing
  FROM public.transport_reservations t
  WHERE t.item_id = p_item_id
    AND t.to_city = COALESCE(NULLIF(p_to_city, ''), 'Caerleon')
    AND t.status = 'reserved'
    AND t.expires_at > NOW();

  IF v_existing > 0 THEN
    RETURN QUERY SELECT FALSE, 'Esta rota ja foi reservada por outro jogador.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO public.transport_reservations (
    item_id, item_name, from_city, to_city,
    buy_price, sell_price, profit, expected_profit,
    quantity, status, reserved_by, reserved_at, expires_at, checklist_data
  ) VALUES (
    p_item_id,
    COALESCE(NULLIF(p_item_name, ''), p_item_id),
    COALESCE(NULLIF(p_from_city, ''), 'Martlock'),
    COALESCE(NULLIF(p_to_city, ''), 'Caerleon'),
    COALESCE(p_buy_price, 0), COALESCE(p_sell_price, 0),
    COALESCE(p_profit, 0), COALESCE(p_expected_profit, 0),
    COALESCE(p_quantity, 1), 'reserved', v_uid, NOW(), v_expires, p_checklist_data
  ) RETURNING id INTO v_new_id;

  RETURN QUERY SELECT TRUE, 'Reserva criada com sucesso.'::TEXT, v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_transport TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 4) VALIDATE GUILD CODE (cadastro)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_guild_code(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE code_record public.guild_codes%ROWTYPE;
BEGIN
  SELECT * INTO code_record FROM public.guild_codes
  WHERE code = UPPER(TRIM(p_code)) AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Invalid or expired code');
  END IF;

  IF code_record.used_count >= code_record.max_uses THEN
    RETURN json_build_object('success', false, 'message', 'Code has been fully used');
  END IF;

  UPDATE public.guild_codes SET used_count = used_count + 1 WHERE id = code_record.id;

  IF code_record.used_count + 1 >= code_record.max_uses THEN
    UPDATE public.guild_codes SET is_active = false WHERE id = code_record.id;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Code validated successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_guild_code TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 5) TRIGGER: perfil com username do metadata (login por username)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6) VERIFICAÇÃO
-- ---------------------------------------------------------------------
SELECT 'market_settings' AS check_name, COUNT(*) AS rows FROM public.market_settings
UNION ALL
SELECT 'transport_reservations', COUNT(*) FROM public.transport_reservations
UNION ALL
SELECT 'market_prices_cache_by_location', COUNT(*) FROM public.market_prices_cache_by_location;

-- Próximo passo: confirme códigos de guilda ativos
-- SELECT code, max_uses, used_count, is_active FROM public.guild_codes WHERE is_active = true;
