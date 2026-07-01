import { supabase } from './client';

const mapMissionRow = (row) => ({
  rank: Number(row.rank),
  profileId: row.profile_id,
  username: row.username,
  displayName: row.albion_character_name || row.username,
  score: Number(row.total_points || 0),
  secondary: Number(row.completed_missions || 0),
  secondaryLabel: 'missões',
});

const mapFameRow = (row) => ({
  rank: Number(row.rank),
  profileId: row.profile_id,
  username: row.username,
  displayName: row.albion_character_name || row.username,
  score: Number(row.fame_delta || 0),
  secondary: null,
  secondaryLabel: 'fama',
});

export const getMissionCompletionRanking = async (limit = 30) => {
  try {
    const { data, error } = await supabase.rpc('get_mission_completion_ranking', {
      p_limit: limit,
    });
    if (error) throw error;
    return { success: true, data: (data || []).map(mapMissionRow) };
  } catch (error) {
    console.error('Get mission completion ranking error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const getMonthlyFameRanking = async (category = 'pvp', limit = 30) => {
  try {
    const { data, error } = await supabase.rpc('get_monthly_fame_ranking', {
      p_category: category,
      p_limit: limit,
    });
    if (error) throw error;
    return { success: true, data: (data || []).map(mapFameRow) };
  } catch (error) {
    console.error('Get monthly fame ranking error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const RANKING_TABS = [
  {
    id: 'missions',
    label: 'Missões',
    description: 'Pontos das missões concluídas na guilda',
    scoreLabel: 'Pontos',
    load: (limit) => getMissionCompletionRanking(limit),
  },
  {
    id: 'pvp',
    label: 'PvP',
    description: 'Fama PvP acumulada no mês (Kill Fame)',
    scoreLabel: 'Fama PvP',
    load: (limit) => getMonthlyFameRanking('pvp', limit),
  },
  {
    id: 'pve',
    label: 'PvE',
    description: 'Fama PvE acumulada no mês',
    scoreLabel: 'Fama PvE',
    load: (limit) => getMonthlyFameRanking('pve', limit),
  },
  {
    id: 'gathering',
    label: 'Coleta',
    description: 'Fama de coleta acumulada no mês',
    scoreLabel: 'Fama Coleta',
    load: (limit) => getMonthlyFameRanking('gathering', limit),
  },
];
