import { createClient } from '@supabase/supabase-js';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { config } from '../config.js';
import { isModuleEnabled } from './settings.js';

let supabase = null;
function db() {
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  if (!supabase) supabase = createClient(config.supabaseUrl, config.supabaseKey);
  return supabase;
}

/** eventId -> { meta, roles, signups, messageId, channelId } */
export const contentEvents = new Map();

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return roles
    .filter((r) => r && r.id)
    .map((r) => ({
      id: String(r.id),
      label: String(r.label || r.id),
      emoji: r.emoji || '🎭',
      slots: Number(r.slots) || 0,
    }));
}

export function buildContentEmbed(ev, signups) {
  const roles = normalizeRoles(ev.roles);
  const total = signups.length;

  const roleLines = roles.map((role) => {
    const users = signups.filter((s) => s.role_id === role.id || s.roleId === role.id);
    const cap = role.slots ? `/${role.slots}` : '';
    const names =
      users.length === 0
        ? '—'
        : users.map((u, i) => `${i + 1}. ${u.display_name || u.displayName}`).join('\n');
    return `**${role.emoji} ${role.label}** (${users.length}${cap})\n${names}`;
  });

  const cols = [];
  for (let i = 0; i < roleLines.length; i += 2) {
    cols.push({ name: '\u200b', value: roleLines.slice(i, i + 2).join('\n\n'), inline: true });
  }

  const infoParts = [];
  if (ev.event_date) infoParts.push(`📅 ${ev.event_date}`);
  if (ev.event_time) infoParts.push(`🕒 ${ev.event_time}`);
  if (ev.max_participants) infoParts.push(`👥 ${total}/${ev.max_participants}`);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: 'Content • I V E N U M I' })
    .setTitle(ev.content_type ? `${ev.title} — ${ev.content_type}` : ev.title)
    .addFields(
      { name: 'Informações', value: infoParts.join('  ·  ') || '—', inline: false },
      { name: 'Descrição', value: (ev.description || '—').slice(0, 1024), inline: false },
      ...cols
    )
    .setFooter({ text: `Inscritos: ${total} · Clique na sua função` })
    .setTimestamp(new Date(ev.starts_at || Date.now()));

  return embed;
}

export function buildContentButtons(ev) {
  const roles = normalizeRoles(ev.roles);
  const rows = [];
  let current = new ActionRowBuilder();

  // Máximo de 4 linhas de roles (a 5ª é reservada para Sign Off) => até 20 roles
  const limited = roles.slice(0, 20);
  for (const role of limited) {
    if (current.components.length >= 5) {
      rows.push(current);
      current = new ActionRowBuilder();
    }
    let btn = new ButtonBuilder()
      .setCustomId(`content:${ev.id}:${role.id}`)
      .setLabel(role.label.slice(0, 40))
      .setStyle(ButtonStyle.Primary);
    // Emojis unicode simples; ignora se for texto inválido
    if (role.emoji && /\p{Emoji}/u.test(role.emoji)) {
      try {
        btn = btn.setEmoji(role.emoji);
      } catch {
        /* noop */
      }
    }
    current.addComponents(btn);
  }
  if (current.components.length) rows.push(current);

  const signOff = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`content:${ev.id}:signoff`)
      .setLabel('Sair')
      .setStyle(ButtonStyle.Danger)
  );
  rows.push(signOff);

  return rows.slice(0, 5);
}

export async function loadContentSignups(eventId) {
  const client = db();
  if (!client) return [];
  const { data } = await client
    .from('discord_content_signups')
    .select('user_id, display_name, role_id, role_label')
    .eq('event_id', eventId);
  return data || [];
}

export async function saveContentSignup(eventId, signup) {
  const client = db();
  if (!client) return;
  await client.from('discord_content_signups').upsert(
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

export async function removeContentSignup(eventId, userId) {
  const client = db();
  if (!client) return;
  await client
    .from('discord_content_signups')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
}

export async function loadContentEvent(eventId) {
  const client = db();
  if (!client) return null;
  const { data: ev } = await client
    .from('discord_content_events')
    .select('*')
    .eq('id', eventId)
    .eq('is_active', true)
    .maybeSingle();
  if (!ev) return null;

  const signups = await loadContentSignups(eventId);
  const state = { ev, roles: normalizeRoles(ev.roles), signups, messageId: ev.message_id, channelId: ev.channel_id };
  contentEvents.set(eventId, state);
  return state;
}

export async function hydrateContentEvents() {
  const client = db();
  if (!client) return;
  const { data: events } = await client
    .from('discord_content_events')
    .select('*')
    .eq('is_active', true)
    .eq('discord_notified', true)
    .order('created_at', { ascending: false })
    .limit(30);

  for (const ev of events || []) {
    const signups = await loadContentSignups(ev.id);
    contentEvents.set(ev.id, {
      ev,
      roles: normalizeRoles(ev.roles),
      signups,
      messageId: ev.message_id,
      channelId: ev.channel_id,
    });
  }
  console.log(`[Celeste D.] ${events?.length || 0} conteúdo(s) restaurado(s)`);
}

export async function pollNewContent(discordClient) {
  const client = db();
  const channelId = config.contentChannelId || config.raidsChannelId;
  if (!client || !channelId) return;
  if (!(await isModuleEnabled('content_enabled'))) return;

  const { data: events } = await client
    .from('discord_content_events')
    .select('*')
    .eq('is_active', true)
    .eq('discord_notified', false)
    .order('created_at', { ascending: true })
    .limit(5);

  if (!events?.length) return;

  const channel = await discordClient.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  for (const ev of events) {
    const embed = buildContentEmbed(ev, []);
    const components = buildContentButtons(ev);
    const msg = await channel
      .send({
        content: `✨ **${ev.title}** — inscreva-se na sua função`,
        embeds: [embed],
        components,
      })
      .catch((e) => {
        console.warn('[Celeste D.] Falha ao postar conteúdo:', e?.message);
        return null;
      });
    if (!msg) continue;

    await client
      .from('discord_content_events')
      .update({
        discord_notified: true,
        message_id: msg.id,
        channel_id: msg.channelId,
        guild_id: config.guildId || null,
      })
      .eq('id', ev.id);

    contentEvents.set(ev.id, {
      ev,
      roles: normalizeRoles(ev.roles),
      signups: [],
      messageId: msg.id,
      channelId: msg.channelId,
    });
  }
}

export async function handleContentButton(interaction) {
  const parts = interaction.customId.split(':');
  if (parts[0] !== 'content' || parts.length < 3) return;

  const eventId = parts[1];
  const action = parts[2];

  let state = contentEvents.get(eventId);
  if (!state) state = await loadContentEvent(eventId);
  if (!state) {
    await interaction.reply({
      content: 'Evento não encontrado ou encerrado.',
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const displayName = interaction.member?.displayName || interaction.user.username;

  if (action === 'signoff') {
    state.signups = state.signups.filter((s) => (s.user_id || s.userId) !== userId);
    await removeContentSignup(eventId, userId);
  } else {
    const role = state.roles.find((r) => r.id === action);
    if (!role) return;

    // respeita limite de vagas por role (se definido)
    if (role.slots > 0) {
      const taken = state.signups.filter(
        (s) => (s.role_id || s.roleId) === role.id && (s.user_id || s.userId) !== userId
      ).length;
      if (taken >= role.slots) {
        await interaction.reply({
          content: `A função **${role.label}** já está cheia (${role.slots}).`,
          ephemeral: true,
        });
        return;
      }
    }

    state.signups = state.signups.filter((s) => (s.user_id || s.userId) !== userId);
    state.signups.push({
      user_id: userId,
      display_name: displayName,
      role_id: role.id,
      role_label: role.label,
    });
    await saveContentSignup(eventId, {
      userId,
      displayName,
      roleId: role.id,
      roleLabel: role.label,
    });
  }

  const embed = buildContentEmbed(state.ev, state.signups);
  const components = buildContentButtons(state.ev);
  await interaction.update({ embeds: [embed], components });
}

export function startContentPoller(discordClient) {
  const channelId = config.contentChannelId || config.raidsChannelId;
  if (!channelId) {
    console.warn('[Celeste D.] Content desativado (canal ausente)');
    return;
  }
  pollNewContent(discordClient);
  setInterval(() => pollNewContent(discordClient), config.contentPollMs);
}
