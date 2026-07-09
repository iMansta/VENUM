const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Celeste Bot está online!');
});

app.listen(port, () => {
  console.log(`Servidor web rodando na porta ${port}`);
});
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  Client,
  GatewayIntentBits,
  Events,
  MessageFlags,
  ActivityType,
} from 'discord.js';
import { config, assertConfig, resolveGuildId } from './config.js';
import {
  buildRaidEmbed,
  buildRaidButtons,
  parseRaidDate,
  raidEvents,
  RAID_ROLES,
} from './commands.js';
import { handleMissionButton, startMissionPoller } from './services/missions.js';
import { startAnnouncementPoller } from './services/announcements.js';
import { startKillboardPoller, startBattleboardPoller } from './services/killboards.js';
import {
  createRaidEvent,
  hydrateRaidEvents,
  loadRaidEvent,
  removeSignup,
  saveSignup,
} from './services/raids.js';
import {
  startContentPoller,
  hydrateContentEvents,
  handleContentButton,
} from './services/content.js';

assertConfig();
await resolveGuildId();

const startedAt = Date.now();
let botReady = false;

const healthPort = Number(process.env.PORT || process.env.CELESTE_D_HEALTH_PORT || 3001);
const healthServer = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(botReady ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: botReady,
        uptimeMs: Date.now() - startedAt,
        guildId: config.guildId || null,
        readyAt: botReady ? new Date().toISOString() : null,
      })
    );
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Celeste D. online');
});

healthServer.listen(healthPort, () => {
  console.log(`[Celeste D.] Health server listening on :${healthPort}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`[Celeste D.] Online como ${c.user.tag}`);
  await c.user.setActivity('I V E N U M I', { type: ActivityType.Watching });
  await hydrateRaidEvents(client);
  await hydrateContentEvents(client);
  startMissionPoller(client);
  startAnnouncementPoller(client);
  startContentPoller(client);
  startKillboardPoller(client);
  startBattleboardPoller(client);
  botReady = true;
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      const cid = String(interaction.customId || '');
      if (cid.startsWith('mission:')) {
        await handleMissionButton(interaction);
      } else if (cid.startsWith('content:')) {
        await handleContentButton(interaction);
      } else {
        await handleRaidButton(interaction);
      }
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

client.on(Events.Error, (err) => {
  console.error('[Celeste D.] Client error:', err);
});

client.on(Events.ShardDisconnect, (event, id) => {
  botReady = false;
  console.warn(`[Celeste D.] Shard ${id} disconnected`, event?.code || '');
});

client.on(Events.ShardResume, (id, replayed) => {
  botReady = true;
  console.log(`[Celeste D.] Shard ${id} resumed (${replayed} events replayed)`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Celeste D.] unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Celeste D.] uncaughtException:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  try {
    await client.destroy();
  } finally {
    process.exit(0);
  }
});

process.on('SIGTERM', async () => {
  try {
    await client.destroy();
  } finally {
    process.exit(0);
  }
});

async function handleCommand(interaction) {
  const { commandName } = interaction;

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
