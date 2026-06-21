-- =====================================================================
-- VENUM MARKET - Migration: fix reserve_transport RPC signature
-- =====================================================================
-- A função anterior tinha uma assinatura mínima que NÃO casava com os
-- parâmetros enviados pelo frontend (`src/lib/supabase/transports.js`
-- → `reserveTransportOpportunity`), o que causava o erro:
--
--   "Funcao reserve_transport nao encontrada no Supabase"
--   (PGRST202 / 404 no PostgREST)
--
-- Esta migration é idempotente e substitui a definição antiga pela
-- assinatura completa alinhada com o frontend.
--
-- Aplicar no Supabase SQL Editor APÓS `schema.sql` e
-- `schema_market_refactor.sql`.
-- =====================================================================

-- Remove versão antiga se existir (qualquer assinatura)
DROP FUNCTION IF EXISTS public.reserve_transport(
  TEXT, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, UUID, TIMESTAMPTZ
) CASCADE;

DROP FUNCTION IF EXISTS public.reserve_transport(
  TEXT, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER,
  UUID, TIMESTAMPTZ, JSONB
) CASCADE;

DROP FUNCTION IF EXISTS public.reserve_transport CASCADE;

-- ---------------------------------------------------------------------
-- reserve_transport: cria uma reserva atômica em `transports`.
--
-- Parâmetros (todos prefixados com `p_`):
--   p_item_id        TEXT         - id do item (ex: T6_MAIN_SWORD)
--   p_item_name      TEXT         - nome localizado (fallback = item_id)
--   p_from_city      TEXT         - cidade de compra (menor preço)
--   p_to_city        TEXT         - cidade de venda (ex: Caerleon / BM)
--   p_buy_price      NUMERIC      - preço unitário de compra
--   p_sell_price     NUMERIC      - preço unitário de venda no destino
--   p_profit         NUMERIC      - lucro líquido unitário (após taxas)
--   p_expected_profit NUMERIC     - lucro esperado (com fator de risco)
--   p_quantity       INTEGER      - quantidade a transportar
--   p_reserved_by    UUID         - auth.uid() do reservante
--   p_expires_at     TIMESTAMPTZ  - expiração da reserva (20 min)
--   p_checklist_data JSONB        - opcional, payload do checklist
--                                  (pode ser NULL na versão sem checklist)
--
-- Retorno:
--   TABLE { success BOOLEAN, message TEXT, transport_id UUID }
-- ---------------------------------------------------------------------
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
  v_uid        UUID := COALESCE(p_reserved_by, auth.uid());
  v_existing   INTEGER;
  v_new_id     UUID;
BEGIN
  -- 0) sanity checks
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

  -- 1) concorrência: alguém já reservou este item para o mesmo destino?
  SELECT COUNT(*) INTO v_existing
  FROM public.transports t
  WHERE t.item_id  = p_item_id
    AND t.to_city  = COALESCE(NULLIF(p_to_city, ''), 'Caerleon')
    AND t.status   = 'reserved'
    AND t.expires_at IS NOT NULL
    AND t.expires_at > NOW();

  IF v_existing > 0 THEN
    RETURN QUERY SELECT FALSE,
      'Esta rota acabou de ser assumida por outro jogador.',
      NULL::UUID;
    RETURN;
  END IF;

  -- 2) expiração default = 20 minutos a partir de agora
  IF p_expires_at IS NULL THEN
    p_expires_at := NOW() + INTERVAL '20 minutes';
  END IF;

  -- 3) insere reserva atômica
  INSERT INTO public.transports (
    item_id,
    item_name,
    from_city,
    to_city,
    buy_price,
    sell_price,
    profit,
    expected_profit,
    quantity,
    status,
    reserved_by,
    reserved_at,
    expires_at,
    created_by,
    checklist_data
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
    v_uid,
    p_checklist_data
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT TRUE, 'Reserva criada com sucesso.', v_new_id;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.reserve_transport TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_transport TO anon;