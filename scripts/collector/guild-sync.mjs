import { createClient } from '@supabase/supabase-js';
import {
  GUILD_NAME,
  GAMEINFO_BASE,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} from './config.mjs';

const normalize = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

const monthKey = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const parseGatheringFame = (player) => {
  const g = player?.Gathering || player?.gathering;
  if (!g) return 0;
  if (g.All?.Fame != null) return Number(g.All.Fame) || 0;
  if (g.All?.TotalFame != null) return Number(g.All.TotalFame) || 0;
  return Object.values(g).reduce((sum, cat) => {
    if (cat && typeof cat === 'object') {
      return sum + (Number(cat.Fame) || Number(cat.TotalFame) || 0);
    }
    return sum;
  }, 0);
};

const parseCraftFame = (player) => {
  const c = player?.Crafting || player?.crafting;
  if (!c) return 0;
  return Number(c.TotalFame || c.Fame || 0);
};

const parsePveFame = (player, killFame, gatherFame, craftFame) => {
  const direct = Number(player?.PveFame || player?.Pve?.Fame || 0);
  if (direct > 0) return direct;
  const total = Number(player?.Fame || player?.TotalFame || 0);
  if (total <= 0) return 0;
  return Math.max(0, total - killFame - gatherFame - craftFame);
};

async function fetchPlayerFame(playerName) {
  const searchRes = await fetch(
    `${GAMEINFO_BASE}/search?q=${encodeURIComponent(playerName)}`
  );
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const player = (searchData.players || []).find(
    (p) => p.Name?.toLowerCase() === String(playerName).toLowerCase()
  );
  if (!player?.Id) return null;

  const detailRes = await fetch(`${GAMEINFO_BASE}/players/${player.Id}`);
  if (!detailRes.ok) return null;

  const detail = await detailRes.json();
  const killFame = Number(detail.KillFame || 0);
  const gatherFame = parseGatheringFame(detail);
  const craftFame = parseCraftFame(detail);
  const pveFame = parsePveFame(detail, killFame, gatherFame, craftFame);

  return {
    playerId: player.Id,
    killFame,
    pveFame,
    gatherFame,
  };
}

async function ensureFameBaseline(supabase, profileId, fame) {
  const key = monthKey();
  const { data: existing } = await supabase
    .from('profile_fame_baselines')
    .select('id')
    .eq('profile_id', profileId)
    .eq('month_key', key)
    .maybeSingle();

  if (!existing) {
    await supabase.from('profile_fame_baselines').insert({
      profile_id: profileId,
      month_key: key,
      kill_fame: fame.killFame,
      pve_fame: fame.pveFame,
      gathering_fame: fame.gatherFame,
    });
  }
}

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
  let fameSynced = 0;

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

    if (inGuild) {
      try {
        const fame = await fetchPlayerFame(charName);
        if (fame) {
          await supabase
            .from('profiles')
            .update({
              albion_player_id: fame.playerId,
              albion_kill_fame: fame.killFame,
              albion_pve_fame: fame.pveFame,
              albion_gathering_fame: fame.gatherFame,
              albion_fame_synced_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          await ensureFameBaseline(supabase, profile.id, fame);
          fameSynced++;
        }
      } catch (err) {
        console.warn(`[GUILD SYNC] Fame skip ${charName}:`, err?.message);
      }
    }
  }

  console.log(
    `[GUILD SYNC] Membros: ${memberNames.size} | Reativados: ${activated} | Inativados: ${deactivated} | Fame: ${fameSynced}`
  );

  return { memberCount: memberNames.size, activated, deactivated, fameSynced };
}
