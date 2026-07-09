import { supabase } from './client';

const mapMissionRow = (row, rank) => ({
  rank,
  profileId: row.id || row.profile_id,
  username: row.username,
  displayName: row.username || row.full_name || 'Membro',
  score: Number(row.total_points || 0),
  secondary: 0,
  secondaryLabel: 'missões',
  avatarUrl: row.avatar_url || null,
});

const mapFameRow = (row, rank, field) => ({
  rank,
  profileId: row.id,
  username: row.username,
  displayName: row.username || row.full_name || 'Membro',
  score: Number(row[field] || 0),
  secondary: null,
  secondaryLabel: 'fama',
  avatarUrl: row.avatar_url || null,
});

const isMissingRpc = (error) =>
  error?.code === 'PGRST202' || error?.status === 404;

const attachAvatarUrls = async (rows = []) => {
  const ids = [...new Set(rows.map((row) => row.profileId).filter(Boolean))];
  if (ids.length === 0) return rows;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .in('id', ids);

  if (error) return rows;

  const avatarById = new Map((data || []).map((row) => [row.id, row.avatar_url || null]));
  return rows.map((row) => ({
    ...row,
    avatarUrl: row.avatarUrl || avatarById.get(row.profileId) || null,
  }));
};

/** Fallback seguro — só colunas base de profiles. */
const fallbackMissionRanking = async (limit = 30) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, total_points, avatar_url')
    .order('total_points', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = (data || []).map((row, i) => mapMissionRow(row, i + 1));
  return attachAvatarUrls(rows);
};

const fallbackFameRanking = async (field, limit = 30) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`id, username, full_name, avatar_url, ${field}`)
    .order(field, { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === '42703') return [];
    throw error;
  }

  const rows = (data || [])
    .filter((row) => Number(row[field] || 0) > 0)
    .map((row, i) => mapFameRow(row, i + 1, field));
  return attachAvatarUrls(rows);
};

export const getMissionCompletionRanking = async (limit = 30) => {
  try {
    const { data, error } = await supabase.rpc('get_mission_completion_ranking', {
      p_limit: limit,
    });

    if (error) {
      if (isMissingRpc(error)) {
        const fallback = await fallbackMissionRanking(limit);
        return { success: true, data: fallback, source: 'fallback' };
      }
      throw error;
    }

    const mapped = (data || []).map((row) => ({
      rank: Number(row.rank),
      profileId: row.profile_id,
      username: row.username,
      displayName: row.albion_character_name || row.username,
      score: Number(row.total_points || 0),
      secondary: Number(row.completed_missions || 0),
      secondaryLabel: 'missões',
      avatarUrl: null,
    }));

    return {
      success: true,
      source: 'rpc',
      data: await attachAvatarUrls(mapped),
    };
  } catch (error) {
    console.error('Get mission completion ranking error:', error);
    try {
      const fallback = await fallbackMissionRanking(limit);
      return { success: true, data: fallback, source: 'fallback' };
    } catch {
      return { success: false, error: error.message, data: [] };
    }
  }
};

// Ranking de fama desde a ENTRADA na guild (delta em relação ao baseline).
export const getGuildFameRanking = async (category = 'pvp', limit = 30) => {
  const fieldMap = {
    pvp: 'albion_kill_fame',
    pve: 'albion_pve_fame',
    gathering: 'albion_gathering_fame',
  };
  const field = fieldMap[category] || 'albion_kill_fame';

  try {
    let { data, error } = await supabase.rpc('get_guild_fame_ranking', {
      p_category: category,
      p_limit: limit,
    });

    // Compatibilidade: se o novo RPC ainda não foi aplicado, tenta o antigo (mensal).
    if (error && isMissingRpc(error)) {
      ({ data, error } = await supabase.rpc('get_monthly_fame_ranking', {
        p_category: category,
        p_limit: limit,
      }));
    }

    if (error) {
      if (isMissingRpc(error)) {
        const fallback = await fallbackFameRanking(field, limit);
        return { success: true, data: fallback, source: 'fallback' };
      }
      throw error;
    }

    const mapped = (data || []).map((row) => ({
      rank: Number(row.rank),
      profileId: row.profile_id,
      username: row.username,
      displayName: row.albion_character_name || row.username,
      score: Number(row.fame_delta || 0),
      secondary: null,
      secondaryLabel: 'fama',
      avatarUrl: null,
    }));

    return {
      success: true,
      source: 'rpc',
      data: await attachAvatarUrls(mapped),
    };
  } catch (error) {
    console.error('Get guild fame ranking error:', error);
    try {
      const fallback = await fallbackFameRanking(field, limit);
      return { success: true, data: fallback, source: 'fallback' };
    } catch {
      return { success: false, error: error.message, data: [] };
    }
  }
};

// Alias mantido por compatibilidade com chamadas existentes.
export const getMonthlyFameRanking = getGuildFameRanking;

export const RANKING_TABS = [
  {
    id: 'missions',
    label: 'Missões',
    description: 'Pontos de missões desde a entrada na guild',
    scoreLabel: 'Pontos',
    load: (limit) => getMissionCompletionRanking(limit),
  },
  {
    id: 'pvp',
    label: 'PvP',
    description: 'Fama PvP conquistada desde a entrada na guild',
    scoreLabel: 'Fama PvP',
    load: (limit) => getGuildFameRanking('pvp', limit),
  },
  {
    id: 'pve',
    label: 'PvE',
    description: 'Fama PvE conquistada desde a entrada na guild',
    scoreLabel: 'Fama PvE',
    load: (limit) => getGuildFameRanking('pve', limit),
  },
  {
    id: 'gathering',
    label: 'Coleta',
    description: 'Fama de coleta conquistada desde a entrada na guild',
    scoreLabel: 'Fama Coleta',
    load: (limit) => getGuildFameRanking('gathering', limit),
  },
];
