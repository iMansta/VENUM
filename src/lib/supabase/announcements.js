import { supabase } from './client';

export const getGuildAnnouncements = async (limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('guild_announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get guild announcements error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const createGuildAnnouncement = async (payload) => {
  try {
    const { data, error } = await supabase
      .from('guild_announcements')
      .insert({
        title: payload.title,
        message: payload.message,
        created_by: payload.created_by,
        is_active: true,
        discord_notified: false,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Create guild announcement error:', error);
    return { success: false, error: error.message };
  }
};

export const updateGuildAnnouncement = async (id, payload) => {
  try {
    const { data, error } = await supabase
      .from('guild_announcements')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Update guild announcement error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteGuildAnnouncement = async (id) => {
  try {
    const { error } = await supabase.from('guild_announcements').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete guild announcement error:', error);
    return { success: false, error: error.message };
  }
};

