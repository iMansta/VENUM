import { supabase } from './client';

/**
 * Transport operations for VENUM MARKET
 */

const RESERVE_TRANSPORT_RPC = 'reserve_transport';

const getReserveTransportErrorMessage = (error) => {
  if (!error) return 'Falha ao reservar transporte. Tente novamente.';

  const details = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  const status = error.status || error.code;

  if (status === 404 || error.code === 'PGRST202' || details.includes(RESERVE_TRANSPORT_RPC)) {
    return 'Funcao reserve_transport nao encontrada no Supabase. Verifique se a SQL foi aplicada no banco.';
  }

  return error.message || 'Falha ao reservar transporte. Tente novamente.';
};

// Reserve a transport opportunity through the reserve_transport database function
export const reserveTransportOpportunity = async ({
  opportunity,
  userId,
  itemName,
  expiresAt,
  checklistData,
}) => {
  const rpcParams = {
    p_item_id: opportunity.itemId,
    p_item_name: itemName,
    p_from_city: opportunity.lowestCity,
    p_to_city: 'Caerleon',
    p_buy_price: opportunity.lowestPrice,
    p_sell_price: opportunity.bmPrice,
    p_profit: opportunity.netProfit,
    p_expected_profit: opportunity.expectedProfit,
    p_quantity: opportunity.quantity || 1,
    p_reserved_by: userId,
    p_expires_at: expiresAt,
    p_checklist_data: checklistData,
  };

  try {
    const { data, error } = await supabase.rpc(RESERVE_TRANSPORT_RPC, rpcParams);

    if (error) {
      console.error('reserve_transport RPC error:', {
        error,
        rpc: RESERVE_TRANSPORT_RPC,
        params: rpcParams,
      });

      return {
        success: false,
        message: getReserveTransportErrorMessage(error),
        error,
      };
    }

    if (data?.success === false) {
      console.warn('reserve_transport RPC returned failure:', {
        data,
        rpc: RESERVE_TRANSPORT_RPC,
        params: rpcParams,
      });

      return {
        success: false,
        message: data.message || 'Esta rota acabou de ser assumida por outro jogador',
        data,
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected reserve_transport error:', {
      error,
      rpc: RESERVE_TRANSPORT_RPC,
      params: rpcParams,
    });

    return {
      success: false,
      message: getReserveTransportErrorMessage(error),
      error,
    };
  }
};

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
