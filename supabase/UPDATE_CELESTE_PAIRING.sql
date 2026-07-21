-- =====================================================================
-- Pareamento Anaconda ↔ perfil VENUM (membros)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.celeste_pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_client_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_celeste_pairing_tokens_token
  ON public.celeste_pairing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_celeste_pairing_tokens_profile
  ON public.celeste_pairing_tokens(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_celeste_pairing_tokens_expires
  ON public.celeste_pairing_tokens(expires_at);

ALTER TABLE public.celeste_pairing_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access celeste pairing tokens" ON public.celeste_pairing_tokens;
CREATE POLICY "No direct access celeste pairing tokens"
  ON public.celeste_pairing_tokens FOR ALL USING (false) WITH CHECK (false);

SELECT 'UPDATE_CELESTE_PAIRING aplicado' AS status;
