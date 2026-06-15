import { supabase } from './client';

/**
 * Transport operations for VENUM MARKET
 */

// Reserve a transport opportunity
export const reserveTransport = async (transportId, userId) => {
  try {
    const { data, error } = await supabase
      .from('transports')
      .update({ 
        status: 'reserved',
        reserved_by: userId,
        reserved_at: new Date().toISOString()
      })
      .eq('id', transportId)
      .eq('status', 'available')
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Reserve transport error:', error);
    return { success: false, error: error.message };
  }
};

// Cancel a transport reservation
export const cancelTransportReservation = async (transportId, userId) => {
  try {
    const { data, error } = await supabase
      .from('transports')
      .update({ 
        status: 'available',
        reserved_by: null,
        reserved_at: null
      })
      .eq('id', transportId)
      .eq('reserved_by', userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Cancel transport reservation error:', error);
    return { success: false, error: error.message };
  }
};

// Get available transports (excluding reserved ones)
export const getAvailableTransports = async () => {
  try {
    const { data, error } = await supabase
      .from('transports')
      .select('*')
      .eq('status', 'available')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get available transports error:', error);
    return { success: false, error: error.message };
  }
};

// Get user's reserved transports
export const getUserReservedTransports = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('transports')
      .select('*')
      .eq('reserved_by', userId)
      .eq('status', 'reserved')
      .order('reserved_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get user reserved transports error:', error);
    return { success: false, error: error.message };
  }
};

// Create a new transport opportunity
export const createTransport = async (transportData) => {
  try {
    const { data, error } = await supabase
      .from('transports')
      .insert({
        ...transportData,
        status: 'available',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Create transport error:', error);
    return { success: false, error: error.message };
  }
};
