-- =====================================================================
-- VENUM - Guild metrics dashboard support
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.guild_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  guild_name TEXT NOT NULL,
  member_count INTEGER,
  silver_amount BIGINT,
  season_points BIGINT,
  kill_fame BIGINT,
  death_fame BIGINT,
  total_fame BIGINT,
  source TEXT DEFAULT 'unknown',
  payload JSONB,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_metrics_snapshots_collected_at
  ON public.guild_metrics_snapshots(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_guild_metrics_snapshots_guild
  ON public.guild_metrics_snapshots(guild_id, collected_at DESC);

ALTER TABLE public.guild_metrics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guild metrics are viewable by members" ON public.guild_metrics_snapshots;
CREATE POLICY "Guild metrics are viewable by members"
  ON public.guild_metrics_snapshots FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "No direct writes guild metrics" ON public.guild_metrics_snapshots;
CREATE POLICY "No direct writes guild metrics"
  ON public.guild_metrics_snapshots FOR ALL USING (false) WITH CHECK (false);

