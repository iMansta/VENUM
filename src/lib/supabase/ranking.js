import { supabase } from './client';

const mapMissionRow = (row, rank) => ({
  rank,
  profileId: row.id || row.profile_id,
  username: row.username,
  displayName: row.username || row.full_name || 'Membro',
  score: Number(row.total_points || 0),
  secondary: 0,
  secondaryLabel: 'missões',
});

const mapFameRow = (row, rank, field) => ({
  rank,
  profileId: row.id,
  username: row.username,
  displayName: row.username || row.full_name || 'Membro',
  score: Number(row[field] || 0),
  secondary: null,
  secondaryLabel: 'fama',
});

const isMissingRpc = (error) =>
  error?.code === 'PGRST202' || error?.status === 404;

/** Fallback seguro — só colunas base de profiles. */
const fallbackMissionRanking = async (limit = 30) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, total_points')
    .order('total_points', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row, i) => mapMissionRow(row, i + 1));
};

const fallbackFameRanking = async (field, limit = 30) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`id, username, full_name, ${field}`)
    .order(field, { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === '42703') return [];
    throw error;
  }

  return (data || [])
    .filter((row) => Number(row[field] || 0) > 0)
    .map((row, i) => mapFameRow(row, i + 1, field));
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

    return {
      success: true,
      source: 'rpc',
      data: (data || []).map((row) => ({
        rank: Number(row.rank),
        profileId: row.profile_id,
        username: row.username,
        displayName: row.albion_character_name || row.username,
        score: Number(row.total_points || 0),
        secondary: Number(row.completed_missions || 0),
        secondaryLabel: 'missões',
      })),
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

export const getMonthlyFameRanking = async (category = 'pvp', limit = 30) => {
  const fieldMap = {
    pvp: 'albion_kill_fame',
    pve: 'albion_pve_fame',
    gathering: 'albion_gathering_fame',
  };
  const field = fieldMap[category] || 'albion_kill_fame';

  try {
    const { data, error } = await supabase.rpc('get_monthly_fame_ranking', {
      p_category: category,
      p_limit: limit,
    });

    if (error) {
      if (isMissingRpc(error)) {
        const fallback = await fallbackFameRanking(field, limit);
        return { success: true, data: fallback, source: 'fallback' };
      }
      throw error;
    }

    return {
      success: true,
      source: 'rpc',
      data: (data || []).map((row) => ({
        rank: Number(row.rank),
        profileId: row.profile_id,
        username: row.username,
        displayName: row.albion_character_name || row.username,
        score: Number(row.fame_delta || 0),
        secondary: null,
        secondaryLabel: 'fama',
      })),
    };
  } catch (error) {
    console.error('Get monthly fame ranking error:', error);
    try {
      const fallback = await fallbackFameRanking(field, limit);
      return { success: true, data: fallback, source: 'fallback' };
    } catch {
      return { success: false, error: error.message, data: [] };
    }
  }
};

export const RANKING_TABS = [
  {
    id: 'missions',
    label: 'Missões',
    description: 'Pontos acumulados na guilda',
    scoreLabel: 'Pontos',
    load: (limit) => getMissionCompletionRanking(limit),
  },
  {
    id: 'pvp',
    label: 'PvP',
    description: 'Fama PvP mensal (Celeste sincroniza)',
    scoreLabel: 'Fama PvP',
    load: (limit) => getMonthlyFameRanking('pvp', limit),
  },
  {
    id: 'pve',
    label: 'PvE',
    description: 'Fama PvE mensal (Celeste sincroniza)',
    scoreLabel: 'Fama PvE',
    load: (limit) => getMonthlyFameRanking('pve', limit),
  },
  {
    id: 'gathering',
    label: 'Coleta',
    description: 'Fama de coleta mensal (Celeste sincroniza)',
    scoreLabel: 'Fama Coleta',
    load: (limit) => getMonthlyFameRanking('gathering', limit),
  },
];
