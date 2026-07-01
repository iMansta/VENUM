import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  missionsChannelId: process.env.DISCORD_MISSIONS_CHANNEL_ID,
  announcementsChannelId: process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID,
  raidsChannelId: process.env.DISCORD_RAIDS_CHANNEL_ID || process.env.DISCORD_MISSIONS_CHANNEL_ID,
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  guildName: process.env.GUILD_NAME || 'I V E N U M I',
  missionPollMs: Number(process.env.MISSION_POLL_MS || 60_000),
};

export function assertConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_BOT_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (missing.length) {
    throw new Error(`Celeste D. — faltam variáveis: ${missing.join(', ')}`);
  }
}
