import { createClient } from '@supabase/supabase-js';
import {
  GUILD_NAME,
  GAMEINFO_BASE,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} from './config.mjs';

const normalize = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

export async function syncGuildMembers() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const searchRes = await fetch(
    `${GAMEINFO_BASE}/search?q=${encodeURIComponent(GUILD_NAME)}`
  );
  if (!searchRes.ok) throw new Error(`GameInfo search: ${searchRes.status}`);
  const searchData = await searchRes.json();
  const guild = (searchData.guilds || []).find(
    (g) => normalize(g.Name) === normalize(GUILD_NAME)
  );
  if (!guild) throw new Error(`Guilda "${GUILD_NAME}" não encontrada no GameInfo`);

  const membersRes = await fetch(`${GAMEINFO_BASE}/guilds/${guild.Id}/members`);
  if (!membersRes.ok) throw new Error(`GameInfo members: ${membersRes.status}`);
  const members = await membersRes.json();
  const memberNames = new Set(
    (members || []).map((m) => String(m.Name || '').toLowerCase())
  );

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, albion_character_name, role, is_active');

  if (error) throw error;

  let activated = 0;
  let deactivated = 0;

  for (const profile of profiles || []) {
    const charName = (
      profile.albion_character_name ||
      profile.username ||
      ''
    ).toLowerCase();

    if (!charName) continue;
    if (profile.role === 'admin') continue;

    const inGuild = memberNames.has(charName);

    if (inGuild && !profile.is_active) {
      await supabase
        .from('profiles')
        .update({
          is_active: true,
          guild_verified: true,
          last_guild_verified_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
      activated++;
    } else if (!inGuild && profile.is_active) {
      await supabase
        .from('profiles')
        .update({
          is_active: false,
          guild_verified: false,
          last_guild_verified_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
      deactivated++;
    } else if (inGuild) {
      await supabase
        .from('profiles')
        .update({ last_guild_verified_at: new Date().toISOString(), guild_verified: true })
        .eq('id', profile.id);
    }
  }

  console.log(
    `[GUILD SYNC] Membros in-game: ${memberNames.size} | Reativados: ${activated} | Inativados: ${deactivated}`
  );

  return { memberCount: memberNames.size, activated, deactivated };
}
