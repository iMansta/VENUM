import { supabase } from './client';

/**
 * Points operations for VENUM MARKET
 */

// Get user's points ledger
export const getUserPointsLedger = async (profileId, limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get user points ledger error:', error);
    return { success: false, error: error.message };
  }
};

// Award points to user (officers/admins only)
export const awardPoints = async (profileId, amount, reason, referenceId = null, referenceType = null) => {
  try {
    const { error } = await supabase.rpc('award_points', {
      p_profile_id: profileId,
      p_amount: amount,
      p_reason: reason,
      p_reference_id: referenceId,
      p_reference_type: referenceType,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Award points error:', error);
    return { success: false, error: error.message };
  }
};

// Deduct points from user (system use only)
export const deductPoints = async (profileId, amount, reason, referenceId = null, referenceType = null) => {
  try {
    const { data, error } = await supabase.rpc('deduct_points', {
      p_profile_id: profileId,
      p_amount: amount,
      p_reason: reason,
      p_reference_id: referenceId,
      p_reference_type: referenceType,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Deduct points error:', error);
    return { success: false, error: error.message };
  }
};

// Adjust points manually (officers/admins only)
export const adjustPoints = async (profileId, amount, reason, createdBy) => {
  try {
    const transactionType = amount >= 0 ? 'earned' : 'spent';
    const { error } = await supabase.from('points_ledger').insert({
      profile_id: profileId,
      amount: amount,
      transaction_type: 'adjusted',
      reason: reason,
      created_by: createdBy,
    });

    if (error) throw error;

    // Update profile total
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        total_points: supabase.raw('total_points + ?', [amount]),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Adjust points error:', error);
    return { success: false, error: error.message };
  }
};

// Get all points transactions (officers/admins only)
export const getAllPointsLedger = async (limit = 100) => {
  try {
    const { data, error } = await supabase
      .from('points_ledger')
      .select(`
        *,
        profiles(username, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get all points ledger error:', error);
    return { success: false, error: error.message };
  }
};

// Get points statistics for a user
export const getUserPointsStats = async (profileId) => {
  try {
    const { data, error } = await supabase
      .from('points_ledger')
      .select('transaction_type, amount')
      .eq('profile_id', profileId);

    if (error) throw error;

    const stats = {
      totalEarned: 0,
      totalSpent: 0,
      transactionCount: data.length,
    };

    data.forEach((transaction) => {
      if (transaction.transaction_type === 'earned' || transaction.transaction_type === 'adjusted') {
        stats.totalEarned += transaction.amount > 0 ? transaction.amount : 0;
      } else if (transaction.transaction_type === 'spent' || transaction.transaction_type === 'adjusted') {
        stats.totalSpent += transaction.amount < 0 ? Math.abs(transaction.amount) : 0;
      }
    });

    return { success: true, data: stats };
  } catch (error) {
    console.error('Get user points stats error:', error);
    return { success: false, error: error.message };
  }
};
