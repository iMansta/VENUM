-- =====================================================================
-- Discord <-> Missões: participação por botão no canal
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_user_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_discord_user_id
  ON public.profiles(discord_user_id);

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS discord_message_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_button_closed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_missions_discord_message_id
  ON public.missions(discord_message_id);

SELECT 'UPDATE_DISCORD_MISSION_BRIDGE aplicado' AS status;
