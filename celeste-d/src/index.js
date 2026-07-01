import { randomUUID } from 'node:crypto';
import {
  Client,
  GatewayIntentBits,
  Events,
  MessageFlags,
  ActivityType,
} from 'discord.js';
import { config, assertConfig, resolveGuildId } from './config.js';
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
import {
  createRaidEvent,
  hydrateRaidEvents,
  loadRaidEvent,
  removeSignup,
  saveSignup,
} from './services/raids.js';

assertConfig();
await resolveGuildId();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`[Celeste D.] Online como ${c.user.tag}`);
  await c.user.setActivity('I V E N U M I', { type: ActivityType.Watching });
  await hydrateRaidEvents(client);
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
    const channelId = config.announcementsChannelId;
    const channel = await interaction.client.channels.fetch(channelId);
    const embed = buildAnnouncementEmbed({
      title: interaction.options.getString('titulo'),
      message: interaction.options.getString('mensagem'),
      author: interaction.member?.displayName || interaction.user.username,
    });
    await channel.send({ embeds: [embed] });
    await interaction.reply({
      content: `Aviso publicado em <#${channelId}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (commandName === 'missao') {
    const channelId = config.missionsChannelId;
    const channel = await interaction.client.channels.fetch(channelId);
    const embed = buildMissionEmbed({
      title: interaction.options.getString('titulo'),
      description: interaction.options.getString('descricao'),
      points: interaction.options.getInteger('pontos'),
      author: interaction.member?.displayName || interaction.user.username,
      hubUrl: config.hubUrl,
    });
    await channel.send({ embeds: [embed] });
    await interaction.reply({
      content: `Missão publicada em <#${channelId}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (commandName === 'raid') {
    const title = interaction.options.getString('titulo');
    const date = interaction.options.getString('data');
    const time = interaction.options.getString('hora');
    const description = interaction.options.getString('descricao') || '—';

    const eventId = randomUUID();
    const startsAt = parseRaidDate(date, time).getTime();
    const meta = {
      title,
      date,
      time,
      description,
      startsAt,
      creator: interaction.user.id,
    };

    raidEvents.set(eventId, { meta, signups: [] });

    const embed = buildRaidEmbed(eventId, meta, []);
    const components = buildRaidButtons(eventId);
    const channelId = config.raidsChannelId;
    const channel = await interaction.client.channels.fetch(channelId);
    const msg = await channel.send({
      content: `📅 **${title}** — clique na sua função para se inscrever`,
      embeds: [embed],
      components,
    });

    raidEvents.set(eventId, {
      meta,
      signups: [],
      messageId: msg.id,
      channelId: msg.channelId,
    });

    await createRaidEvent({
      eventId,
      meta,
      channelId: msg.channelId,
      messageId: msg.id,
      guildId: config.guildId || interaction.guildId,
    });

    await interaction.reply({
      content: `Raid criada em <#${channelId}>`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleRaidButton(interaction) {
  const parts = interaction.customId.split(':');
  if (parts[0] !== 'raid' || parts.length < 3) return;

  const eventId = parts[1];
  const action = parts[2];
  let state = raidEvents.get(eventId);

  if (!state) {
    state = await loadRaidEvent(eventId);
    if (!state) {
      await interaction.reply({
        content: 'Evento não encontrado. Peça à staff para recriar a raid.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const userId = interaction.user.id;
  const displayName = interaction.member?.displayName || interaction.user.username;

  if (action === 'signoff') {
    state.signups = state.signups.filter((s) => s.userId !== userId);
    await removeSignup(eventId, userId);
  } else {
    const role = RAID_ROLES.find((r) => r.id === action);
    if (!role) return;

    state.signups = state.signups.filter((s) => s.userId !== userId);
    const signup = { userId, displayName, roleId: role.id, roleLabel: role.label };
    state.signups.push(signup);
    await saveSignup(eventId, signup);
  }

  const embed = buildRaidEmbed(eventId, state.meta, state.signups);
  const components = buildRaidButtons(eventId);
  await interaction.update({ embeds: [embed], components });
}

client.login(config.token);
