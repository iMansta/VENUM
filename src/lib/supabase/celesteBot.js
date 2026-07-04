import { supabase } from './client';

/**
 * Configurações do bot Celeste (Discord). Linha única (id=1).
 * O bot (celeste-d) consulta esta tabela periodicamente e liga/desliga
 * os anúncios conforme as flags. A página web não inicia o processo do
 * bot (ele roda 24/7 fora da Vercel), apenas controla o comportamento.
 */

export const getBotSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('celeste_bot_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get bot settings error:', error);
    return { success: false, error: error.message };
  }
};

export const updateBotSettings = async (updates, updatedBy = null) => {
  try {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (updatedBy) payload.updated_by = updatedBy;

    const { data, error } = await supabase
      .from('celeste_bot_settings')
      .update(payload)
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Update bot settings error:', error);
    return { success: false, error: error.message };
  }
};
