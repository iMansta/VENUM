import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const RAID_ROLES = [
  { id: 'main_tank', label: 'Main-tank', emoji: '🛡️' },
  { id: 'off_tank', label: 'Off-tank', emoji: '🔰' },
  { id: 'cobra', label: 'Cobra', emoji: '🐍' },
  { id: 'main_healer', label: 'Main-healer', emoji: '💚' },
  { id: 'bruxo', label: 'Bruxo', emoji: '🔮' },
  { id: 'frost', label: 'Frost', emoji: '❄️' },
  { id: 'foice', label: 'Foice', emoji: '⚔️' },
  { id: 'raiz', label: 'Raiz', emoji: '🌿' },
  { id: 'coringa', label: 'Coringa', emoji: '🃏' },
  { id: 'scout', label: 'Scout', emoji: '👁️' },
];

export const commands = [
  new SlashCommandBuilder()
    .setName('aviso')
    .setDescription('Publica aviso da guilda no canal configurado')
    .addStringOption((o) => o.setName('titulo').setDescription('Título').setRequired(true))
    .addStringOption((o) => o.setName('mensagem').setDescription('Conteúdo').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('missao')
    .setDescription('Anuncia missão ativa do hub VENUM')
    .addStringOption((o) => o.setName('titulo').setDescription('Título').setRequired(true))
    .addStringOption((o) => o.setName('descricao').setDescription('Descrição').setRequired(true))
    .addIntegerOption((o) => o.setName('pontos').setDescription('Recompensa em pontos').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Cria evento AVA/CTG estilo Raid-Helper')
    .addStringOption((o) => o.setName('titulo').setDescription('Ex: AVA B2B VENUM').setRequired(true))
    .addStringOption((o) => o.setName('data').setDescription('DD/MM/AAAA').setRequired(true))
    .addStringOption((o) => o.setName('hora').setDescription('HH:MM (24h)').setRequired(true))
    .addStringOption((o) =>
      o.setName('descricao').setDescription('Requisitos, IP, saída, builds').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),
].map((c) => c.toJSON());

export function buildMissionEmbed({ title, description, points, author, hubUrl }) {
  const embed = new EmbedBuilder()
    .setColor(0xeab308)
    .setTitle(`🎯 Nova Missão — ${title}`)
    .setDescription(description)
    .addFields(
      { name: 'Recompensa', value: `${points} pontos`, inline: true },
      { name: 'Guilda', value: 'I V E N U M I', inline: true }
    )
    .setFooter({ text: author ? `${author} · Celeste D.` : 'Celeste D. · Hub VENUM' })
    .setTimestamp();

  if (hubUrl) {
    embed.setURL(hubUrl);
    embed.addFields({ name: 'Hub', value: `[Abrir missões](${hubUrl}/missions)`, inline: false });
  }
  return embed;
}

export function buildAnnouncementEmbed({ title, message, author }) {
  return new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle(`📢 ${title}`)
    .setDescription(message)
    .setFooter({ text: author ? `${author} · Celeste D.` : 'Celeste D.' })
    .setTimestamp();
}

/** Estado em memória: messageId -> { roles, signups, meta } */
export const raidEvents = new Map();

export function buildRaidEmbed(eventId, meta, signups) {
  const roleLines = RAID_ROLES.map((role) => {
    const users = signups.filter((s) => s.roleId === role.id);
    const names =
      users.length === 0
        ? '—'
        : users.map((u, i) => `${i + 1}. ${u.displayName}`).join('\n');
    return `**${role.emoji} ${role.label}** (${users.length})\n${names}`;
  });

  const cols = [];
  for (let i = 0; i < roleLines.length; i += 2) {
    cols.push({ name: '\u200b', value: roleLines.slice(i, i + 2).join('\n\n'), inline: true });
  }

  const total = signups.length;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(meta.title)
    .addFields(
      { name: 'Event Info', value: `**Date:** ${meta.date}\n**Time:** ${meta.time}`, inline: false },
      { name: 'Description', value: meta.description || '—', inline: false },
      ...cols
    )
    .setFooter({
      text: `Sign ups: Total: ${total} · Event ID: ${eventId}`,
    })
    .setTimestamp(new Date(meta.startsAt || Date.now()));

  return embed;
}

export function buildRaidButtons(eventId) {
  const rows = [];
  let current = new ActionRowBuilder();

  for (const role of RAID_ROLES) {
    if (current.components.length >= 5) {
      rows.push(current);
      current = new ActionRowBuilder();
    }
    current.addComponents(
      new ButtonBuilder()
        .setCustomId(`raid:${eventId}:${role.id}`)
        .setLabel(role.label)
        .setEmoji(role.emoji)
        .setStyle(ButtonStyle.Primary)
    );
  }
  if (current.components.length) rows.push(current);

  const signOff = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`raid:${eventId}:signoff`)
      .setLabel('Sign Off')
      .setStyle(ButtonStyle.Danger)
  );
  rows.push(signOff);

  return rows.slice(0, 5);
}

export function parseRaidDate(dateStr, timeStr) {
  const [d, m, y] = dateStr.split('/').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}
