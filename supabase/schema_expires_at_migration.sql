-- =====================================================================
-- VENUM MARKET - Migration: garantir expires_at em transport_reservations
-- =====================================================================
-- Esta migration é IDEMPOTENTE e robusta:
--   1) Cria a tabela `transport_reservations` se ela ainda não existir.
--   2) Garante que a coluna `expires_at` exista.
--   3) (Re)cria a função `reserve_transport` com `expires_at` default
--      = NOW() + 30 minutos.
--
-- Erro que ela corrige:
--   - "relation public.transport_reservations does not exist" (42P01)
--   - "Failed to run sql query: 400 Bad Request" no reserve_transport
--     por causa da coluna expires_at ausente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabela transport_reservations (idempotente)
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
-- 2) Garantir coluna expires_at (se a tabela já existia sem ela)
-- ---------------------------------------------------------------------
ALTER TABLE public.transport_reservations
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------
-- 3) (Re)criar função reserve_transport (idempotente)
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

  -- Concurrency check
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

  -- expires_at default = 30 minutos a partir de agora
  IF p_expires_at IS NULL THEN
    p_expires_at := NOW() + INTERVAL '30 minutes';
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