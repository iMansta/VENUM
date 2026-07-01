import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  contentChannelId: process.env.DISCORD_CONTENT_CHANNEL_ID,
  missionsChannelId: process.env.DISCORD_MISSIONS_CHANNEL_ID,
  announcementsChannelId: process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID,
  raidsChannelId:
    process.env.DISCORD_RAIDS_CHANNEL_ID ||
    process.env.DISCORD_CONTENT_CHANNEL_ID ||
    process.env.DISCORD_MISSIONS_CHANNEL_ID,
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  guildName: process.env.GUILD_NAME || 'I V E N U M I',
  hubUrl: process.env.VITE_APP_URL || 'https://venum-eight.vercel.app',
  missionPollMs: Number(process.env.MISSION_POLL_MS || 60_000),
};

export function assertConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_BOT_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.missionsChannelId) missing.push('DISCORD_MISSIONS_CHANNEL_ID');
  if (missing.length) {
    throw new Error(`Celeste D. — faltam variáveis: ${missing.join(', ')}`);
  }
}

/** Resolve guild_id via API Discord a partir de um canal configurado. */
export async function resolveGuildId() {
  if (config.guildId) return config.guildId;

  const probeChannel =
    config.missionsChannelId || config.announcementsChannelId || config.raidsChannelId;
  if (!probeChannel || !config.token) return null;

  const res = await fetch(`https://discord.com/api/v10/channels/${probeChannel}`, {
    headers: { Authorization: `Bot ${config.token}` },
  });

  if (!res.ok) {
    console.warn('[Celeste D.] Não foi possível resolver DISCORD_GUILD_ID — verifique token e IDs');
    return null;
  }

  const data = await res.json();
  if (data.guild_id) {
    config.guildId = data.guild_id;
    console.log(`[Celeste D.] Guild ID: ${data.guild_id}`);
  }
  return config.guildId;
}
