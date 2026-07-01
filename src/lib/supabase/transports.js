import { supabase } from './client';

/**
 * Reserva uma oportunidade de transporte via RPC `reserve_transport`.
 */
export const reserveTransportOpportunity = async ({
  opportunity,
  userId,
  itemName,
  expiresAt,
}) => {
  try {
    const { data, error } = await supabase.rpc('reserve_transport', {
      p_item_id: opportunity.itemId,
      p_item_name: itemName || opportunity.itemId,
      p_from_city: opportunity.lowestCity,
      p_to_city: opportunity.sellCity || 'Caerleon',
      p_buy_price: opportunity.lowestPrice ?? 0,
      p_sell_price: opportunity.bmPrice ?? 0,
      p_profit: opportunity.netProfit ?? 0,
      p_expected_profit: opportunity.expectedProfit ?? opportunity.netProfit ?? 0,
      p_quantity: opportunity.quantity ?? 1,
      p_reserved_by: userId,
      p_expires_at: expiresAt,
      p_checklist_data: null,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.success === false) {
      return { success: false, message: row.message || 'Falha ao reservar' };
    }

    return {
      success: true,
      message: row?.message || 'Reserva criada com sucesso',
      transportId: row?.transport_id,
    };
  } catch (error) {
    console.error('Reserve transport error:', error);
    return {
      success: false,
      message: error.message || 'Erro ao reservar transporte',
    };
  }
};
