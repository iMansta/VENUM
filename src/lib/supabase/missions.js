import { supabase } from './client';

const missionSelect = `
  *,
  mission_participants (
    id,
    profile_id,
    contribution_quantity,
    joined_at
  )
`;

export const getActiveMissions = async () => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .select(missionSelect)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get active missions error:', error);
    return { success: false, error: error.message };
  }
};

// Histórico de Missões do usuário: missões que ele concluiu (individual ou grupo),
// registradas em mission_reward_events no momento da premiação.
export const getUserMissionHistory = async (profileId) => {
  try {
    const { data, error } = await supabase
      .from('mission_reward_events')
      .select(
        `id, mission_id, awarded_points, awarded_at,
         missions ( id, title, description, mission_type, mission_scope, target_item, target_quantity, points_reward )`
      )
      .eq('profile_id', profileId)
      .order('awarded_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get user mission history error:', error);
    return { success: false, error: error.message };
  }
};

export const createMission = async (missionData) => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .insert({ ...missionData, status: 'active', discord_notified: false })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Create mission error:', error);
    return { success: false, error: error.message };
  }
};

export const updateMission = async (missionId, updates) => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', missionId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Update mission error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteMission = async (missionId) => {
  try {
    const { error } = await supabase.from('missions').delete().eq('id', missionId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete mission error:', error);
    return { success: false, error: error.message };
  }
};

export const joinMission = async (missionId, profileId) => {
  try {
    const { data, error } = await supabase
      .from('mission_participants')
      .insert({ mission_id: missionId, profile_id: profileId })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Join mission error:', error);
    return { success: false, error: error.message };
  }
};

export const leaveMission = async (missionId, profileId) => {
  try {
    const { error } = await supabase
      .from('mission_participants')
      .delete()
      .eq('mission_id', missionId)
      .eq('profile_id', profileId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Leave mission error:', error);
    return { success: false, error: error.message };
  }
};
