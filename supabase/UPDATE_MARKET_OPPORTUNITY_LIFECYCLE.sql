-- =====================================================================
-- IVENUMI Hub - Black Market opportunity lifecycle
-- =====================================================================
-- Regras:
-- - Precos cruzados para BM valem por no maximo 1 hora.
-- - Cache expirado deve sair do banco.
-- - Reserva/conclusao de uma oportunidade bloqueia nova reserva do mesmo
--   item/cidade ate a validade expirar.
-- =====================================================================

ALTER TABLE public.transport_reservations
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tr_active_opportunity
  ON public.transport_reservations(item_id, to_city, status, expires_at);

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
    (p_item_id, p_location, p_price_data, NOW(), NOW() + INTERVAL '1 hour')
  ON CONFLICT (item_id, location) DO UPDATE
    SET price_data = EXCLUDED.price_data,
        cached_at  = NOW(),
        expires_at = NOW() + INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_cached_market_price_by_location TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cached_market_price_by_location TO anon;

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

CREATE OR REPLACE FUNCTION public.cleanup_market_lifecycle()
RETURNS JSONB AS $$
DECLARE
  deleted_prices INTEGER := 0;
  expired_reservations INTEGER := 0;
BEGIN
  SELECT public.clear_expired_market_cache_by_location() INTO deleted_prices;

  UPDATE public.transport_reservations
  SET status = 'expired'
  WHERE status = 'reserved'
    AND expires_at IS NOT NULL
    AND expires_at <= NOW();

  GET DIAGNOSTICS expired_reservations = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_price_rows', deleted_prices,
    'expired_reservations', expired_reservations
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_market_lifecycle TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_market_lifecycle TO anon;

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
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    transport_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_uid UUID := COALESCE(p_reserved_by, auth.uid());
    v_existing INTEGER;
    v_new_id UUID;
    v_expires TIMESTAMPTZ := COALESCE(p_expires_at, NOW() + INTERVAL '1 hour');
BEGIN
    PERFORM public.cleanup_market_lifecycle();

    IF v_uid IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Usuario nao autenticado.'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF p_item_id IS NULL OR LENGTH(TRIM(p_item_id)) = 0 THEN
        RETURN QUERY SELECT FALSE, 'item_id obrigatorio.'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_existing
    FROM public.transport_reservations t
    WHERE t.item_id = p_item_id
      AND t.to_city = COALESCE(NULLIF(p_to_city, ''), 'Caerleon')
      AND t.status IN ('reserved', 'completed')
      AND (t.expires_at IS NULL OR t.expires_at > NOW());

    IF v_existing > 0 THEN
        RETURN QUERY SELECT FALSE, 'Esta oportunidade ja foi reservada ou concluida nesta janela de preco.'::TEXT, NULL::UUID;
        RETURN;
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
        v_expires,
        p_checklist_data
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT TRUE, 'Reserva criada com sucesso.'::TEXT, v_new_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.reserve_transport TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_transport TO anon;

CREATE OR REPLACE FUNCTION public.complete_transport_reservation(p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.transport_reservations
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_id
    AND status = 'reserved'
    AND (
      reserved_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin','officer')
      )
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.complete_transport_reservation TO authenticated;

-- Corrige IDs legados gerados por famílias inexistentes no Albion Render/API.
WITH mapped AS (
  SELECT
    item_id AS old_id,
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(item_id, '^T([0-9]+)_MAIN_BOW(@.*)?$', 'T\1_2H_BOW\2'),
                    '^T([0-9]+)_MAIN_CROSSBOW(@.*)?$', 'T\1_2H_CROSSBOW\2'
                  ),
                  '^T([0-9]+)_MAIN_QUARTERSTAFF(@.*)?$', 'T\1_2H_QUARTERSTAFF\2'
                ),
                '^T([0-9]+)_OFF_HORN(@.*)?$', 'T\1_OFF_HORN_KEEPER\2'
              ),
              '^T([0-9]+)_OFF_ORB(@.*)?$', 'T\1_OFF_ORB_MORGANA\2'
            ),
            '^T([0-9]+)_MOUNT_ARMOREDHORSE(@.*)?$', 'T\1_MOUNT_ARMORED_HORSE\2'
          ),
          '^T([0-9]+)_HEAD_(CLOTH|LEATHER|PLATE)(@.*)?$', 'T\1_HEAD_\2_SET1\3'
        ),
        '^T([0-9]+)_ARMOR_(CLOTH|LEATHER|PLATE)(@.*)?$', 'T\1_ARMOR_\2_SET1\3'
      ),
      '^T([0-9]+)_SHOES_(CLOTH|LEATHER|PLATE)(@.*)?$', 'T\1_SHOES_\2_SET1\3'
    ) AS new_id
  FROM public.market_items
),
changed AS (
  SELECT old_id, new_id
  FROM mapped
  WHERE old_id <> new_id
)
DELETE FROM public.market_items mi
USING changed c
WHERE mi.item_id = c.old_id
  AND EXISTS (SELECT 1 FROM public.market_items existing WHERE existing.item_id = c.new_id);

WITH mapped AS (
  SELECT
    item_id AS old_id,
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(item_id, '^T([0-9]+)_MAIN_BOW(@.*)?$', 'T\1_2H_BOW\2'),
                    '^T([0-9]+)_MAIN_CROSSBOW(@.*)?$', 'T\1_2H_CROSSBOW\2'
                  ),
                  '^T([0-9]+)_MAIN_QUARTERSTAFF(@.*)?$', 'T\1_2H_QUARTERSTAFF\2'
                ),
                '^T([0-9]+)_OFF_HORN(@.*)?$', 'T\1_OFF_HORN_KEEPER\2'
              ),
              '^T([0-9]+)_OFF_ORB(@.*)?$', 'T\1_OFF_ORB_MORGANA\2'
            ),
            '^T([0-9]+)_MOUNT_ARMOREDHORSE(@.*)?$', 'T\1_MOUNT_ARMORED_HORSE\2'
          ),
          '^T([0-9]+)_HEAD_(CLOTH|LEATHER|PLATE)(@.*)?$', 'T\1_HEAD_\2_SET1\3'
        ),
        '^T([0-9]+)_ARMOR_(CLOTH|LEATHER|PLATE)(@.*)?$', 'T\1_ARMOR_\2_SET1\3'
      ),
      '^T([0-9]+)_SHOES_(CLOTH|LEATHER|PLATE)(@.*)?$', 'T\1_SHOES_\2_SET1\3'
    ) AS new_id
  FROM public.market_items
),
changed AS (
  SELECT old_id, new_id
  FROM mapped
  WHERE old_id <> new_id
)
UPDATE public.market_items mi
SET item_id = c.new_id,
    image_url = '/api/albion-render?type=item&id=' || replace(c.new_id, '@', '%40'),
    updated_at = NOW()
FROM changed c
WHERE mi.item_id = c.old_id
  AND NOT EXISTS (SELECT 1 FROM public.market_items existing WHERE existing.item_id = c.new_id);
