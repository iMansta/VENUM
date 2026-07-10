import { supabase } from './client';

// Roles predefinidas (o admin pode adicionar/remover/renomear e criar "Personalizado")
export const CONTENT_ROLE_PRESETS = [
  { id: 'tank', label: 'Tank', emoji: '🛡️' },
  { id: 'main_tank', label: 'Main Tank', emoji: '🛡️' },
  { id: 'off_tank', label: 'Off Tank', emoji: '🔰' },
  { id: 'dps', label: 'DPS', emoji: '⚔️' },
  { id: 'healer', label: 'Healer', emoji: '💚' },
  { id: 'dbuff', label: 'DBuff', emoji: '🔻' },
  { id: 'suporte', label: 'Suporte', emoji: '✨' },
  { id: 'scout', label: 'Scout', emoji: '👁️' },
  { id: 'coringa', label: 'Coringa', emoji: '🃏' },
];

export const CONTENT_TYPE_SUGGESTIONS = [
  'DG Avalonia',
  'Baú Dourado Avalon',
  'Roads of Avalon',
  'ZvZ / CTA',
  'Ganking',
  'Hellgate',
  'Corrupted Dungeon',
];

const contentSelect = `
  *,
  discord_content_signups (
    id,
    user_id,
    display_name,
    role_id,
    role_label
  )
`;

export const getContentEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('discord_content_events')
      .select(contentSelect)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get content events error:', error);
    return { success: false, error: error.message };
  }
};

// Histórico de content: eventos arquivados (is_active=false) ou cujo horário já passou.
export const getContentHistory = async (limit = 60) => {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('discord_content_events')
      .select(contentSelect)
      .or(`is_active.eq.false,starts_at.lt.${nowIso}`)
      .order('starts_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get content history error:', error);
    return { success: false, error: error.message };
  }
};

export const createContentEvent = async (payload) => {
  try {
    const { data, error } = await supabase
      .from('discord_content_events')
      .insert({
        title: payload.title,
        content_type: payload.contentType || null,
        description: payload.description || null,
        event_date: payload.eventDate || null,
        event_time: payload.eventTime || null,
        starts_at: payload.startsAt || null,
        max_participants: payload.maxParticipants || null,
        roles: payload.roles || [],
        created_by: payload.createdBy || null,
        is_active: true,
        discord_notified: false,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Create content event error:', error);
    return { success: false, error: error.message };
  }
};

// Encerrar content: arquiva o evento (is_active=false), movendo-o para o
// Histórico. Permitido ao criador ou a staff/officer/admin (garantido por RLS).
export const closeContentEvent = async (id) => {
  try {
    const { error } = await supabase
      .from('discord_content_events')
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Close content event error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteContentEvent = async (id) => {
  try {
    const { error } = await supabase
      .from('discord_content_events')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete content event error:', error);
    return { success: false, error: error.message };
  }
};
