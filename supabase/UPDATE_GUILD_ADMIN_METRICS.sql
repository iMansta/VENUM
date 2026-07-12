-- =====================================================================
-- VENUM - Coleta administrativa de métricas da guilda (Anaconda Admin)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.guild_admin_pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_admin_pairing_tokens_token
  ON public.guild_admin_pairing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_guild_admin_pairing_tokens_profile
  ON public.guild_admin_pairing_tokens(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guild_admin_pairing_tokens_expires
  ON public.guild_admin_pairing_tokens(expires_at);

ALTER TABLE public.guild_admin_pairing_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access guild admin pairing tokens" ON public.guild_admin_pairing_tokens;
CREATE POLICY "No direct access guild admin pairing tokens"
  ON public.guild_admin_pairing_tokens FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.guild_metrics_snapshots
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_by_username TEXT,
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS verified_by_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_guild_metrics_snapshots_submitted_by
  ON public.guild_metrics_snapshots(submitted_by, collected_at DESC);

SELECT 'UPDATE_GUILD_ADMIN_METRICS aplicado' AS status;
