-- =====================================================================
-- Guild: propriedades (Hideouts / QG) e metadados de aliança
-- =====================================================================
-- A Anaconda (sync server-side) preenche estes campos a partir do detalhe
-- da guild na GameInfo API. Quando a API não expõe determinado dado, o
-- campo fica nulo e a UI mostra "-".
-- =====================================================================

ALTER TABLE public.guild_metrics_snapshots
  ADD COLUMN IF NOT EXISTS alliance_tag TEXT,
  ADD COLUMN IF NOT EXISTS alliance_name TEXT,
  ADD COLUMN IF NOT EXISTS hideout_count INTEGER,
  ADD COLUMN IF NOT EXISTS territory_count INTEGER,
  ADD COLUMN IF NOT EXISTS headquarters TEXT,
  ADD COLUMN IF NOT EXISTS properties JSONB;

SELECT 'UPDATE_GUILD_PROPERTIES aplicado' AS status;
