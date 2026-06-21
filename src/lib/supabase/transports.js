import { supabase } from './client';

/**
 * Transport operations for VENUM MARKET
 *
 * Fluxo simplificado: o usuário clica em "Reservar" e a reserva é
 * criada diretamente (sem checklist intermediário).
 */

const RESERVE_TRANSPORT_RPC = 'reserve_transport';

const getReserveTransportErrorMessage = (error) => {
  if (!error) return 'Falha ao reservar transporte. Tente novamente.';

  const details = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  const status = error.status || error.code;

  if (status === 404 || error.code === 'PGRST202' || details.includes(RESERVE_TRANSPORT_RPC)) {
    return 'Funcao reserve_transport nao encontrada no Supabase. Aplique a migration supabase/schema_reserve_transport.sql.';
  }

  return error.message || 'Falha ao reservar transporte. Tente novamente.';
};

/**
 * Reserva uma oportunidade de transporte via RPC `reserve_transport`.
 *
 * @param {Object}   params
 * @param {Object}   params.opportunity   Oportunidade vinda de fetchTopOpportunities
 * @param {string}   params.userId        auth.uid() do usuário
 * @param {string}   params.itemName      Nome localizado do item (fallback = itemId)
 * @param {string}   params.expiresAt     ISO string da expiração
 * @param {Object=}  params.checklistData Mantido opcional para compat. Não usado no fluxo simplificado.
 *
 * @returns {Promise<{success: boolean, message?: string, data?: any, error?: any}>}
 */
export const reserveTransportOpportunity = async ({
  opportunity,
  userId,
  itemName,
  expiresAt,
  checklistData, // opcional, ignorado no fluxo simplificado
}) => {
  // A RPC `reserve_transport` no Supabase espera p_checklist_data opcional.
  // No fluxo simplificado mandamos NULL; mantemos o parâmetro caso admins
  // ou fluxos antigos queiram usá-lo.
  const rpcParams = {
    p_item_id: opportunity.itemId,
    p_item_name: itemName || opportunity.itemId,
    p_from_city: opportunity.lowestCity,
    p_to_city: opportunity.sellCity || 'Caerleon',
    p_buy_price: opportunity.lowestPrice,
    p_sell_price: opportunity.bmPrice,
    p_profit: opportunity.netProfit,
    p_expected_profit: opportunity.expectedProfit,
    p_quantity: opportunity.quantity || 1,
    p_reserved_by: userId,
    p_expires_at: expiresAt,
    p_checklist_data: checklistData ?? null,
  };

  try {
    const { data, error } = await supabase.rpc(RESERVE_TRANSPORT_RPC, rpcParams);

    if (error) {
      console.error('reserve_transport RPC error:', { error, params: rpcParams });
      return {
        success: false,
        message: getReserveTransportErrorMessage(error),
        error,
      };
    }

    // A função retorna TABLE { success, message, transport_id }.
    // O PostgREST entrega como array de objetos ou objeto único, conforme
    // quantidade de linhas. Normalizamos aqui.
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.success === false) {
      return {
        success: false,
        message: row.message || 'Esta rota acabou de ser assumida por outro jogador',
        data: row,
      };
    }

    return {
      success: true,
      data: row || { success: true },
      transportId: row?.transport_id,
    };
  } catch (error) {
    console.error('Unexpected reserve_transport error:', { error, params: rpcParams });
    return {
      success: false,
      message: getReserveTransportErrorMessage(error),
      error,
    };
  }
};

// Reservar uma rota existente (atualiza status)
export const reserveTransport = async (transportId, userId) => {
  try {
    const { data, error } = await supabase
      .from('transports')
      .update({
        status: 'reserved',
        reserved_by: userId,
        reserved_at: new Date().toISOString(),
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

// Cancelar reserva
export const cancelTransportReservation = async (transportId, userId) => {
  try {
    const { data, error } = await supabase
      .from('transports')
      .update({
        status: 'available',
        reserved_by: null,
        reserved_at: null,
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

// Listar transports disponíveis (não reservados)
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

// Listar transports reservados pelo usuário
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

// Criar uma nova oportunidade de transporte
export const createTransport = async (transportData) => {
  try {
    const { data, error } = await supabase
      .from('transports')
      .insert({
        ...transportData,
        status: 'available',
        created_at: new Date().toISOString(),
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