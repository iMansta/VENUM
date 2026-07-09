-- Avisos com destaque no Discord: prioridade + menção.
-- Executar no SQL editor do Supabase.

ALTER TABLE public.guild_announcements
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS mention text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guild_announcements_priority_check'
  ) THEN
    ALTER TABLE public.guild_announcements
      ADD CONSTRAINT guild_announcements_priority_check
      CHECK (priority IN ('normal', 'important', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guild_announcements_mention_check'
  ) THEN
    ALTER TABLE public.guild_announcements
      ADD CONSTRAINT guild_announcements_mention_check
      CHECK (mention IN ('none', 'here', 'everyone'));
  END IF;
END $$;
