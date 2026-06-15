import { supabase } from './client';

/**
 * Mission operations for VENUM MARKET
 */

// Get all active missions
export const getActiveMissions = async () => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .select(`
        *,
        created_by:profiles(username, full_name),
        mission_participants(
          id,
          profile_id,
          contribution_quantity,
          profiles(username, full_name)
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get active missions error:', error);
    return { success: false, error: error.message };
  }
};

// Get mission by ID
export const getMissionById = async (missionId) => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .select(`
        *,
        created_by:profiles(username, full_name),
        mission_participants(
          id,
          profile_id,
          contribution_quantity,
          joined_at,
          profiles(username, full_name)
        )
      `)
      .eq('id', missionId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get mission by ID error:', error);
    return { success: false, error: error.message };
  }
};

// Create new mission (officers/admins only)
export const createMission = async (missionData) => {
  try {
    console.log('createMission called with:', missionData);
    const { data, error } = await supabase
      .from('missions')
      .insert(missionData)
      .select()
      .single();

    if (error) {
      console.error('Supabase mission insert error:', error);
      throw error;
    }
    console.log('Mission created successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Create mission error:', error);
    return { success: false, error: error.message };
  }
};

// Update mission (officers/admins only)
export const updateMission = async (missionId, updates) => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .update(updates)
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

// Delete mission (officers/admins only)
export const deleteMission = async (missionId) => {
  try {
    const { error } = await supabase
      .from('missions')
      .delete()
      .eq('id', missionId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete mission error:', error);
    return { success: false, error: error.message };
  }
};

// Join mission
export const joinMission = async (missionId, profileId) => {
  try {
    const { data, error } = await supabase
      .from('mission_participants')
      .insert({
        mission_id: missionId,
        profile_id: profileId,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Join mission error:', error);
    return { success: false, error: error.message };
  }
};

// Leave mission
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

// Update contribution quantity (officers/admins only)
export const updateContribution = async (participantId, quantity) => {
  try {
    const { data, error } = await supabase
      .from('mission_participants')
      .update({ contribution_quantity: quantity })
      .eq('id', participantId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Update contribution error:', error);
    return { success: false, error: error.message };
  }
};

// Get user's missions
export const getUserMissions = async (profileId) => {
  try {
    const { data, error } = await supabase
      .from('mission_participants')
      .select(`
        *,
        missions(
          id,
          title,
          description,
          mission_type,
          target_item,
          target_quantity,
          current_quantity,
          points_reward,
          start_date,
          end_date,
          status
        )
      `)
      .eq('profile_id', profileId);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get user missions error:', error);
    return { success: false, error: error.message };
  }
};

// Complete mission (officers/admins only)
export const completeMission = async (missionId) => {
  try {
    // First, get all participants to award points
    const { data: participants, error: participantsError } = await supabase
      .from('mission_participants')
      .select('profile_id, contribution_quantity')
      .eq('mission_id', missionId);

    if (participantsError) throw participantsError;

    // Get mission details
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('points_reward, target_quantity')
      .eq('id', missionId)
      .single();

    if (missionError) throw missionError;

    // Award points to each participant based on contribution
    for (const participant of participants) {
      const contributionRatio = participant.contribution_quantity / mission.target_quantity;
      const pointsToAward = Math.round(mission.points_reward * contributionRatio);

      if (pointsToAward > 0) {
        await supabase.rpc('award_points', {
          p_profile_id: participant.profile_id,
          p_amount: pointsToAward,
          p_reason: `Mission completion: ${missionId}`,
          p_reference_id: missionId,
          p_reference_type: 'mission',
        });
      }
    }

    // Update mission status
    const { data, error } = await supabase
      .from('missions')
      .update({ status: 'completed' })
      .eq('id', missionId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Complete mission error:', error);
    return { success: false, error: error.message };
  }
};
