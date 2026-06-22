-- =====================================================================
-- VENUM MARKET - Fix mínimo: reserve_transport
-- =====================================================================
-- Esta migration é a versão "limpa" recomendada para o SQL Editor do
-- Supabase. Use tag $func$ em vez de $$ para evitar erros de parsing
-- em editores web. Inclui casting ::TEXT explícito nos retornos.
--
-- ANTES de executar este script, garanta que a tabela
-- public.transport_reservations existe (rode schema_expires_at_migration.sql
-- uma vez OU rode só o bloco de CREATE TABLE abaixo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- PRÉ-REQUISITO: tabela transport_reservations (se ainda não existir)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transport_reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_name TEXT,
    from_city TEXT NOT NULL,
    to_city TEXT NOT NULL DEFAULT 'Caerleon',
    buy_price NUMERIC NOT NULL DEFAULT 0,
    sell_price NUMERIC NOT NULL DEFAULT 0,
    profit NUMERIC NOT NULL DEFAULT 0,
    expected_profit NUMERIC NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','completed','cancelled','expired')),
    reserved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    checklist_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transport_reservations
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.transport_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view transport reservations" ON public.transport_reservations;
CREATE POLICY "Anyone can view transport reservations" ON public.transport_reservations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can reserve transport" ON public.transport_reservations;
CREATE POLICY "Authenticated users can reserve transport" ON public.transport_reservations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own reservations" ON public.transport_reservations;
CREATE POLICY "Users can update their own reservations" ON public.transport_reservations FOR UPDATE USING (
    reserved_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','officer'))
);

-- ---------------------------------------------------------------------
-- FUNÇÃO reserve_transport (versão "limpa" com $func$)
-- ---------------------------------------------------------------------
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
    v_expires TIMESTAMPTZ := COALESCE(p_expires_at, NOW() + INTERVAL '30 minutes');
BEGIN
    IF v_uid IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Usuario nao autenticado.'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF p_item_id IS NULL OR LENGTH(TRIM(p_item_id)) = 0 THEN
        RETURN QUERY SELECT FALSE, 'item_id obrigatorio.'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Concurrency check
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