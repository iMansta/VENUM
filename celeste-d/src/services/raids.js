import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { buildRaidEmbed, buildRaidButtons, raidEvents } from '../commands.js';

let supabase = null;

function db() {
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  if (!supabase) supabase = createClient(config.supabaseUrl, config.supabaseKey);
  return supabase;
}

export async function createRaidEvent({ eventId, meta, channelId, messageId, guildId }) {
  const client = db();
  if (!client) return;

  await client.from('discord_raid_events').insert({
    id: eventId,
    guild_id: guildId,
    channel_id: channelId,
    message_id: messageId,
    title: meta.title,
    event_date: meta.date,
    event_time: meta.time,
    description: meta.description,
    starts_at: meta.startsAt ? new Date(meta.startsAt).toISOString() : null,
    creator_id: meta.creator,
    is_active: true,
  });
}

export async function loadSignups(eventId) {
  const client = db();
  if (!client) return [];

  const { data } = await client
    .from('discord_raid_signups')
    .select('user_id, display_name, role_id, role_label')
    .eq('event_id', eventId);

  return (data || []).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    roleId: r.role_id,
    roleLabel: r.role_label,
  }));
}

export async function saveSignup(eventId, signup) {
  const client = db();
  if (!client) return;

  await client.from('discord_raid_signups').upsert(
    {
      event_id: eventId,
      user_id: signup.userId,
      display_name: signup.displayName,
      role_id: signup.roleId,
      role_label: signup.roleLabel,
    },
    { onConflict: 'event_id,user_id' }
  );
}

export async function removeSignup(eventId, userId) {
  const client = db();
  if (!client) return;

  await client.from('discord_raid_signups').delete().eq('event_id', eventId).eq('user_id', userId);
}

export async function loadRaidEvent(eventId) {
  const client = db();
  if (!client) return null;

  const { data: ev, error } = await client
    .from('discord_raid_events')
    .select('*')
    .eq('id', eventId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !ev) return null;

  const signups = await loadSignups(eventId);
  const meta = {
    title: ev.title,
    date: ev.event_date,
    time: ev.event_time,
    description: ev.description,
    startsAt: ev.starts_at ? new Date(ev.starts_at).getTime() : Date.now(),
    creator: ev.creator_id,
  };

  const state = {
    meta,
    signups,
    messageId: ev.message_id,
    channelId: ev.channel_id,
  };
  raidEvents.set(eventId, state);
  return state;
}

export async function hydrateRaidEvents(discordClient) {
  const client = db();
  if (!client) {
    console.warn('[Celeste D.] Raids em memória (Supabase não configurado)');
    return;
  }

  const { data: events, error } = await client
    .from('discord_raid_events')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('[Celeste D.] Erro ao carregar raids:', error.message);
    return;
  }

  for (const ev of events || []) {
    const signups = await loadSignups(ev.id);
    const meta = {
      title: ev.title,
      date: ev.event_date,
      time: ev.event_time,
      description: ev.description,
      startsAt: ev.starts_at ? new Date(ev.starts_at).getTime() : Date.now(),
      creator: ev.creator_id,
    };

    raidEvents.set(ev.id, {
      meta,
      signups,
      messageId: ev.message_id,
      channelId: ev.channel_id,
    });
  }

  console.log(`[Celeste D.] ${events?.length || 0} raid(s) restaurada(s)`);
}

export async function refreshRaidMessage(discordClient, eventId) {
  const state = raidEvents.get(eventId);
  if (!state?.messageId || !state?.channelId) return;

  const channel = await discordClient.channels.fetch(state.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const msg = await channel.messages.fetch(state.messageId).catch(() => null);
  if (!msg) return;

  const embed = buildRaidEmbed(eventId, state.meta, state.signups);
  const components = buildRaidButtons(eventId);
  await msg.edit({ embeds: [embed], components });
}
