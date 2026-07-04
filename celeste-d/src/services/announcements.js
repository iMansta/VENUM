import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { buildAnnouncementEmbed } from '../commands.js';
import { isModuleEnabled } from './settings.js';

let supabase = null;
const notified = new Set();

function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  if (!supabase) supabase = createClient(config.supabaseUrl, config.supabaseKey);
  return supabase;
}

export async function pollNewAnnouncements(client) {
  const db = getSupabase();
  const channelId = config.announcementsChannelId;
  if (!db || !channelId) return;
  if (!(await isModuleEnabled('announcements_enabled'))) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const { data: announcements, error } = await db
    .from('guild_announcements')
    .select('id, title, message, discord_notified, is_active')
    .eq('is_active', true)
    .eq('discord_notified', false)
    .order('created_at', { ascending: true })
    .limit(5);

  if (error || !announcements?.length) return;

  for (const ann of announcements) {
    if (notified.has(ann.id)) continue;

    const embed = buildAnnouncementEmbed({
      title: ann.title,
      message: ann.message || 'Sem descrição',
      author: 'Painel Administrativo',
    });

    const msg = await channel.send({ embeds: [embed] });
    await db
      .from('guild_announcements')
      .update({ discord_notified: true, discord_message_id: msg.id })
      .eq('id', ann.id);
    notified.add(ann.id);
    console.log(`[Celeste D.] Aviso anunciado: ${ann.title}`);
  }
}

export function startAnnouncementPoller(client) {
  if (!getSupabase() || !config.announcementsChannelId) {
    console.warn('[Celeste D.] Poll de avisos desativado (Supabase ou canal não configurado)');
    return;
  }
  pollNewAnnouncements(client);
  setInterval(() => pollNewAnnouncements(client), config.missionPollMs);
}

