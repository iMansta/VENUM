
import { createClient } from '@supabase/supabase-js';
import { GUILD_NAME, GAMEINFO_BASE, SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.mjs';

const normalize = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

export async function syncGuildMembers() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const searchRes = await fetch(`${GAMEINFO_BASE}/search?q=${encodeURIComponent(GUILD_NAME)}`);
  if (!searchRes.ok) throw new Error(`GameInfo: ${searchRes.status}`);
  const searchData = await searchRes.json();
  const guild = (searchData.guilds || []).find(
    (g) => normalize(g.Name) === normalize(GUILD_NAME)
  );
  if (!guild) throw new Error(`Guilda "${GUILD_NAME}" não encontrada`);

  const membersRes = await fetch(`${GAMEINFO_BASE}/guilds/${guild.Id}/members`);
  if (!membersRes.ok) throw new Error(`Membros: ${membersRes.status}`);
  const members = await membersRes.json();
  const memberNames = new Set((members || []).map((m) => String(m.Name || '').toLowerCase()));

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, role, is_active');

  if (error) throw error;

  let activated = 0;
  let deactivated = 0;

  for (const profile of profiles || []) {
    const charName = (profile.username || '').toLowerCase();
    if (!charName || profile.role === 'admin') continue;

    const inGuild = memberNames.has(charName);

    if (inGuild && profile.is_active === false) {
      await supabase.from('profiles').update({ is_active: true }).eq('id', profile.id);
      activated++;
    } else if (!inGuild && profile.is_active !== false) {
      await supabase.from('profiles').update({ is_active: false }).eq('id', profile.id);
      deactivated++;
    }
  }

  console.log(`[CELESTE] Guilda: ${memberNames.size} membros | +${activated} -${deactivated}`);
  return { memberCount: memberNames.size, activated, deactivated };
}
