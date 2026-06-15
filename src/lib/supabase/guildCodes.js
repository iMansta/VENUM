import { supabase } from './client';

/**
 * Guild codes operations for VENUM MARKET
 */

// Get all guild codes
export const getGuildCodes = async () => {
  try {
    const { data, error } = await supabase
      .from('guild_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get guild codes error:', error);
    return { success: false, error: error.message };
  }
};

// Create new guild code
export const createGuildCode = async (codeData) => {
  try {
    console.log('createGuildCode called with:', codeData);
    const { data, error } = await supabase
      .from('guild_codes')
      .insert({
        code: codeData.code,
        max_uses: codeData.max_uses || 1,
        created_by: codeData.createdBy,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    console.log('Guild code created successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Create guild code error:', error);
    return { success: false, error: error.message };
  }
};

// Deactivate guild code
export const deactivateGuildCode = async (codeId) => {
  try {
    const { data, error } = await supabase
      .from('guild_codes')
      .update({ is_active: false })
      .eq('id', codeId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Deactivate guild code error:', error);
    return { success: false, error: error.message };
  }
};

// Delete guild code
export const deleteGuildCode = async (codeId) => {
  try {
    const { error } = await supabase
      .from('guild_codes')
      .delete()
      .eq('id', codeId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete guild code error:', error);
    return { success: false, error: error.message };
  }
};

// Generate random guild code
export const generateGuildCode = () => {
  const prefix = 'VENUM';
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${random}`;
};
