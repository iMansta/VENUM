-- =====================================================================
-- Content: botão "Encerrar" (arquivar para o Histórico)
-- =====================================================================
-- - Adiciona closed_at para registrar quando o content foi encerrado.
-- - Permite que o CRIADOR encerre (update) o próprio content, além de
--   admin/staff/officer (já cobertos pela policy "Officers can manage content").
-- Idempotente.
-- =====================================================================

ALTER TABLE public.discord_content_events
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'discord_content_events'
  ) THEN
    -- Criador pode ver o próprio content
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'discord_content_events'
        AND policyname = 'Creator can update own content'
    ) THEN
      EXECUTE 'DROP POLICY "Creator can update own content" ON public.discord_content_events';
    END IF;

    EXECUTE '
      CREATE POLICY "Creator can update own content"
      ON public.discord_content_events
      FOR UPDATE
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid())
    ';
  END IF;
END $$;

SELECT 'UPDATE_CONTENT_CLOSE aplicado' AS status;
