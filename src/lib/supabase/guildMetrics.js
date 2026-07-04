import { supabase } from './client';

export const getLatestGuildMetrics = async () => {
  try {
    const { data, error } = await supabase
      .from('guild_metrics_snapshots')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data: data || null };
  } catch (error) {
    console.error('Get latest guild metrics error:', error);
    return { success: false, error: error.message };
  }
};

export const getGuildMetricsHistory = async (limit = 48) => {
  try {
    const { data, error } = await supabase
      .from('guild_metrics_snapshots')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get guild metrics history error:', error);
    return { success: false, error: error.message };
  }
};

