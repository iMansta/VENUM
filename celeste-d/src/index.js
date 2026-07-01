import {
  Client,
  GatewayIntentBits,
  Events,
  MessageFlags,
} from 'discord.js';
import { config, assertConfig } from './config.js';
import {
  buildAnnouncementEmbed,
  buildMissionEmbed,
  buildRaidEmbed,
  buildRaidButtons,
  parseRaidDate,
  raidEvents,
  RAID_ROLES,
} from './commands.js';
import { startMissionPoller } from './services/missions.js';

assertConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[Celeste D.] Online como ${c.user.tag}`);
  startMissionPoller(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleRaidButton(interaction);
    }
  } catch (err) {
    console.error('[Celeste D.]', err);
    const msg = { content: 'Erro ao processar. Tente novamente.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

async function handleCommand(interaction) {
  const { commandName } = interaction;

  if (commandName === 'aviso') {
    const channelId = config.announcementsChannelId || interaction.channelId;
    const channel = await interaction.client.channels.fetch(channelId);
    const embed = buildAnnouncementEmbed({
      title: interaction.options.getString('titulo'),
      message: interaction.options.getString('mensagem'),
      author: interaction.user.displayName,
    });
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: 'Aviso publicado!', flags: MessageFlags.Ephemeral });
    return;
  }

  if (commandName === 'missao') {
    const channelId = config.missionsChannelId || interaction.channelId;
    const channel = await interaction.client.channels.fetch(channelId);
    const embed = buildMissionEmbed({
      title: interaction.options.getString('titulo'),
      description: interaction.options.getString('descricao'),
      points: interaction.options.getInteger('pontos'),
      author: interaction.user.displayName,
    });
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: 'Missão anunciada!', flags: MessageFlags.Ephemeral });
    return;
  }

  if (commandName === 'raid') {
    const title = interaction.options.getString('titulo');
    const date = interaction.options.getString('data');
    const time = interaction.options.getString('hora');
    const description = interaction.options.getString('descricao') || '—';

    const eventId = interaction.id;
    const startsAt = parseRaidDate(date, time).getTime();

    raidEvents.set(eventId, {
      meta: { title, date, time, description, startsAt, creator: interaction.user.id },
      signups: [],
    });

    const embed = buildRaidEmbed(eventId, raidEvents.get(eventId).meta, []);
    const components = buildRaidButtons(eventId);

    const channelId = config.raidsChannelId || interaction.channelId;
    const channel = await interaction.client.channels.fetch(channelId);
    const msg = await channel.send({ embeds: [embed], components });

    raidEvents.set(eventId, {
      ...raidEvents.get(eventId),
      messageId: msg.id,
      channelId: msg.channelId,
    });

    await interaction.reply({
      content: `Raid criada em <#${channelId}> — use os botões para inscrever-se.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleRaidButton(interaction) {
  const parts = interaction.customId.split(':');
  if (parts[0] !== 'raid' || parts.length < 3) return;

  const eventId = parts[1];
  const action = parts[2];
  const state = raidEvents.get(eventId);

  if (!state) {
    await interaction.reply({ content: 'Evento expirado ou reinicie o bot.', flags: MessageFlags.Ephemeral });
    return;
  }

  const userId = interaction.user.id;
  const displayName = interaction.member?.displayName || interaction.user.username;

  if (action === 'signoff') {
    state.signups = state.signups.filter((s) => s.userId !== userId);
  } else {
    const role = RAID_ROLES.find((r) => r.id === action);
    if (!role) return;

    state.signups = state.signups.filter((s) => s.userId !== userId);
    state.signups.push({ userId, displayName, roleId: role.id, roleLabel: role.label });
  }

  const embed = buildRaidEmbed(eventId, state.meta, state.signups);
  const components = buildRaidButtons(eventId);

  await interaction.update({ embeds: [embed], components });
}

client.login(config.token);
