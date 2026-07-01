import 'dotenv/config';

export const GUILD_NAME = process.env.GUILD_NAME || 'I V E N U M I';
export const GAMEINFO_BASE =
  process.env.GAMEINFO_BASE ||
  'https://gameinfo.albiononline.com/api/gameinfo';
export const ALBION_DATA_BASE =
  process.env.ALBION_DATA_BASE ||
  'https://west.albion-online-data.com';

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
export const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

export const DISCORD_WEBHOOK_MISSIONS =
  process.env.DISCORD_WEBHOOK_MISSIONS || process.env.DISCORD_WEBHOOK_URL;

export const DISCORD_WEBHOOK_EVENTS = process.env.DISCORD_WEBHOOK_EVENTS;

export const COLLECTOR_INTERVAL_MS = Number(
  process.env.COLLECTOR_INTERVAL_MS || 15 * 60 * 1000
);
export const GUILD_SYNC_INTERVAL_MS = Number(
  process.env.GUILD_SYNC_INTERVAL_MS || 24 * 60 * 60 * 1000
);

export const ROYAL_CITIES = [
  'Martlock',
  'Thetford',
  'Fort Sterling',
  'Lymhurst',
  'Bridgewatch',
];
