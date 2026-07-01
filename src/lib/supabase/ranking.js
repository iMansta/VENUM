import { supabase } from './client';

/**
 * Ranking por missões concluídas na aplicação (participante em missão status=completed).
 */
export const getMissionCompletionRanking = async (limit = 20) => {
  try {
    const { data, error } = await supabase.rpc('get_mission_completion_ranking', {
      p_limit: limit,
    });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((row) => ({
        rank: Number(row.rank),
        profileId: row.profile_id,
        username: row.username,
        displayName: row.albion_character_name || row.username,
        completedMissions: Number(row.completed_missions || 0),
        totalPoints: Number(row.total_points || 0),
      })),
    };
  } catch (error) {
    console.error('Get mission completion ranking error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const getWeeklyRanking = async (limit = 10) => {
  try {
    const { data, error } = await supabase.rpc('get_weekly_ranking', { p_limit: limit });
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get weekly ranking error:', error);
    return { success: false, error: error.message };
  }
};

export const getMonthlyRanking = async (limit = 10) => {
  try {
    const { data, error } = await supabase.rpc('get_monthly_ranking', { p_limit: limit });
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get monthly ranking error:', error);
    return { success: false, error: error.message };
  }
};

export const getUserRankingPosition = async (profileId) => {
  try {
    const { data, error } = await supabase.rpc('get_user_ranking_position', {
      p_profile_id: profileId,
    });
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get user ranking position error:', error);
    return { success: false, error: error.message };
  }
};
