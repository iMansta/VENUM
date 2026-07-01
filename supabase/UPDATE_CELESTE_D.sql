-- =====================================================================
-- Celeste D. — raids persistentes (estilo Raid-Helper)
-- Idempotente
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.discord_raid_events (
  id UUID PRIMARY KEY,
  guild_id TEXT,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  title TEXT NOT NULL,
  event_date TEXT,
  event_time TEXT,
  description TEXT,
  starts_at TIMESTAMPTZ,
  creator_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discord_raid_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.discord_raid_events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT,
  role_id TEXT NOT NULL,
  role_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_raid_signups_event
  ON public.discord_raid_signups (event_id);

ALTER TABLE public.discord_raid_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_raid_signups ENABLE ROW LEVEL SECURITY;

-- Bot usa service_role — membros não acessam direto
DROP POLICY IF EXISTS "Service only discord raids" ON public.discord_raid_events;
CREATE POLICY "Service only discord raids"
  ON public.discord_raid_events FOR ALL USING (false);

DROP POLICY IF EXISTS "Service only discord signups" ON public.discord_raid_signups;
CREATE POLICY "Service only discord signups"
  ON public.discord_raid_signups FOR ALL USING (false);

SELECT 'UPDATE_CELESTE_D aplicado' AS status;
