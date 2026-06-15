import { supabase } from './client';

/**
 * Ranking operations for VENUM MARKET
 */

// Get weekly ranking
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

// Get monthly ranking
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

// Get user ranking position
export const getUserRankingPosition = async (profileId) => {
  try {
    const { data, error } = await supabase.rpc('get_user_ranking_position', { p_profile_id: profileId });
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get user ranking position error:', error);
    return { success: false, error: error.message };
  }
};
