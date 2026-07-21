-- =====================================================================
-- VENUM - Histórico de saldo do Banco da Guilda (coleta passiva Anaconda)
-- =====================================================================
-- Registra leituras de prata quando um membro autorizado abre o banco
-- in-game. Inserções passam pela RPC record_guild_bank_balance, que evita
-- spam quando o jogador abre/fecha a UI várias vezes seguidas.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.guild_bank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  silver_balance BIGINT NOT NULL CHECK (silver_balance >= 0),
  collected_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_bank_history_guild_created
  ON public.guild_bank_history (guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guild_bank_history_collector_created
  ON public.guild_bank_history (collected_by_profile_id, created_at DESC);

-- Acelera a verificação de deduplicação (mesma guilda + mesmo saldo recente).
CREATE INDEX IF NOT EXISTS idx_guild_bank_history_dedupe
  ON public.guild_bank_history (guild_id, silver_balance, created_at DESC);

ALTER TABLE public.guild_bank_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guild bank history viewable by members" ON public.guild_bank_history;
CREATE POLICY "Guild bank history viewable by members"
  ON public.guild_bank_history FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "No direct writes guild bank history" ON public.guild_bank_history;
CREATE POLICY "No direct writes guild bank history"
  ON public.guild_bank_history FOR ALL
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------
-- RPC: record_guild_bank_balance
-- Insere um snapshot do saldo evitando duplicatas em janela curta.
-- Retorno: inserted, history_id, skipped_reason
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_guild_bank_balance(
  p_guild_id TEXT,
  p_silver_balance BIGINT,
  p_collected_by_profile_id UUID,
  p_dedupe_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  inserted BOOLEAN,
  history_id UUID,
  skipped_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guild_id TEXT := NULLIF(trim(p_guild_id), '');
  v_balance BIGINT := p_silver_balance;
  v_profile_id UUID := p_collected_by_profile_id;
  v_window_seconds INTEGER := GREATEST(COALESCE(p_dedupe_window_seconds, 60), 5);
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  IF v_guild_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'guild_id_obrigatorio';
    RETURN;
  END IF;

  IF v_balance IS NULL OR v_balance < 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'silver_balance_invalido';
    RETURN;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'profile_id_obrigatorio';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_profile_id) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'profile_id_inexistente';
    RETURN;
  END IF;

  -- Dedup: mesma guilda + mesmo saldo dentro da janela (ex.: abrir/fechar UI).
  SELECT gb.id
  INTO v_existing_id
  FROM public.guild_bank_history gb
  WHERE gb.guild_id = v_guild_id
    AND gb.silver_balance = v_balance
    AND gb.created_at >= NOW() - make_interval(secs => v_window_seconds)
  ORDER BY gb.created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_existing_id, 'dedupe_mesmo_saldo_janela_curta';
    RETURN;
  END IF;

  INSERT INTO public.guild_bank_history (
    guild_id,
    silver_balance,
    collected_by_profile_id,
    created_at
  )
  VALUES (
    v_guild_id,
    v_balance,
    v_profile_id,
    NOW()
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT TRUE, v_new_id, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.record_guild_bank_balance(TEXT, BIGINT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_guild_bank_balance(TEXT, BIGINT, UUID, INTEGER) TO service_role;

SELECT 'UPDATE_GUILD_BANK_HISTORY aplicado' AS status;
