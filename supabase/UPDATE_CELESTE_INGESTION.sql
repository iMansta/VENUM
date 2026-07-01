-- =====================================================================
-- Celeste ingestion (desktop clients) - estilo Albion Data fan-in
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.celeste_clients (
  client_id TEXT PRIMARY KEY,
  guild_name TEXT,
  app_version TEXT,
  host_name TEXT,
  game_log_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.celeste_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES public.celeste_clients(client_id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  value_numeric NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_celeste_observations_client_time
  ON public.celeste_observations (client_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_celeste_observations_type_time
  ON public.celeste_observations (type, observed_at DESC);

ALTER TABLE public.celeste_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeste_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access celeste clients" ON public.celeste_clients;
CREATE POLICY "No direct access celeste clients"
  ON public.celeste_clients FOR ALL USING (false);

DROP POLICY IF EXISTS "No direct access celeste observations" ON public.celeste_observations;
CREATE POLICY "No direct access celeste observations"
  ON public.celeste_observations FOR ALL USING (false);

SELECT 'UPDATE_CELESTE_INGESTION aplicado' AS status;
