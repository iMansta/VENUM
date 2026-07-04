import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { isModuleEnabled } from './settings.js';

const GAMEINFO_BASE = 'https://gameinfo.albiononline.com/api/gameinfo';
const KILLBOARD_URL = 'https://albiononline.com/killboard';
const RENDER_ITEM = 'https://render.albiononline.com/v1/item';

const seenKillIds = new Set();
const seenBattleIds = new Set();
let killWarmed = false;
let battleWarmed = false;

const normalize = (v) => String(v || '').trim();
const asNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const fmt = (n) => asNumber(n).toLocaleString('pt-BR');

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchGuildKills() {
  const gid = config.albionGuildId;
  if (!gid) return [];

  const direct = await fetchJson(
    `${GAMEINFO_BASE}/guilds/${encodeURIComponent(gid)}/kills?offset=0&limit=20`
  );
  if (Array.isArray(direct) && direct.length) return direct;

  const generic = await fetchJson(`${GAMEINFO_BASE}/events?offset=0&limit=50`);
  if (Array.isArray(generic)) {
    return generic.filter((ev) => {
      const kGuild = normalize(ev?.Killer?.GuildId);
      const vGuild = normalize(ev?.Victim?.GuildId);
      return kGuild === gid || vGuild === gid;
    });
  }
  return [];
}

async function fetchGuildBattles() {
  const gid = config.albionGuildId;
  if (!gid) return [];

  const direct = await fetchJson(
    `${GAMEINFO_BASE}/guilds/${encodeURIComponent(gid)}/battles?offset=0&limit=10`
  );
  if (Array.isArray(direct) && direct.length) return direct;

  const generic = await fetchJson(
    `${GAMEINFO_BASE}/battles?offset=0&limit=30&sort=recent`
  );
  if (Array.isArray(generic)) {
    return generic.filter((b) => {
      const guilds = b?.guilds || b?.Guilds || {};
      return Object.prototype.hasOwnProperty.call(guilds, gid);
    });
  }
  return [];
}

function playerLine(player) {
  const name = normalize(player?.Name || player?.name || '—');
  const guild = normalize(player?.GuildName || player?.guildName);
  const alliance = normalize(player?.AllianceName || player?.allianceName);
  const ip = Math.round(asNumber(player?.AverageItemPower || player?.averageItemPower));
  const tag = alliance ? `[${alliance}] ` : '';
  const guildText = guild ? `${tag}${guild}` : 'Sem guilda';
  return { name, guildText, ip };
}

function buildKillEmbed(kill, gid) {
  const id = String(kill?.EventId || kill?.id || '');
  const killer = playerLine(kill?.Killer);
  const victim = playerLine(kill?.Victim);
  const fame = asNumber(kill?.TotalVictimKillFame || kill?.KillFame);
  const participants = asNumber(
    kill?.numberOfParticipants ||
      (Array.isArray(kill?.Participants) ? kill.Participants.length : 0) ||
      (Array.isArray(kill?.GroupMembers) ? kill.GroupMembers.length : 1)
  );

  const killerIsUs = normalize(kill?.Killer?.GuildId) === gid;
  const color = killerIsUs ? 0x16a34a : 0xdc2626; // verde = vitória, vermelho = baixa
  const headline = killerIsUs
    ? `🟢 ${killer.name} abateu ${victim.name}`
    : `🔴 ${victim.name} foi abatido por ${killer.name}`;

  const mainHand = kill?.Victim?.Equipment?.MainHand?.Type;
  const thumb = mainHand
    ? `${RENDER_ITEM}/${encodeURIComponent(mainHand)}.png`
    : null;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: killerIsUs ? 'Kill • I V E N U M I' : 'Baixa • I V E N U M I' })
    .setTitle(headline)
    .addFields(
      {
        name: '⚔️ Vencedor',
        value: `**${killer.name}**\n${killer.guildText}\nIP ${fmt(killer.ip)}`,
        inline: true,
      },
      {
        name: '💀 Abatido',
        value: `**${victim.name}**\n${victim.guildText}\nIP ${fmt(victim.ip)}`,
        inline: true,
      },
      {
        name: '📊 Combate',
        value: `Fama: **${fmt(fame)}**\nParticipantes: **${participants}**`,
        inline: true,
      }
    )
    .setFooter({ text: 'Albion • Killboard' })
    .setTimestamp(new Date(kill?.TimeStamp || Date.now()));

  if (thumb) embed.setThumbnail(thumb);
  if (id) embed.setURL(`${KILLBOARD_URL}/kill/${id}`);
  return embed;
}

export async function pollKillboard(client) {
  const channelId = config.killboardChannelId;
  const gid = config.albionGuildId;
  if (!channelId || !gid) return;
  if (!(await isModuleEnabled('killboard_enabled'))) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const kills = await fetchGuildKills();
  if (!kills.length) return;

  // Warm-up: na primeira execução apenas marca como visto (não despeja histórico).
  if (!killWarmed) {
    for (const kill of kills) {
      const id = String(kill?.EventId || kill?.id || '');
      if (id) seenKillIds.add(id);
    }
    killWarmed = true;
    return;
  }

  const fresh = kills
    .filter((k) => {
      const id = String(k?.EventId || k?.id || '');
      return id && !seenKillIds.has(id);
    })
    .sort((a, b) => new Date(a?.TimeStamp || 0) - new Date(b?.TimeStamp || 0));

  for (const kill of fresh.slice(0, 5)) {
    const id = String(kill?.EventId || kill?.id || '');
    await channel.send({ embeds: [buildKillEmbed(kill, gid)] }).catch(() => null);
    seenKillIds.add(id);
  }
}

function buildBattleEmbed(battle, gid) {
  const id = String(battle?.id || battle?.Id || '');
  const totalKills = asNumber(battle?.totalKills || battle?.TotalKills);
  const totalFame = asNumber(battle?.totalFame || battle?.TotalFame);
  const players = battle?.players || battle?.Players || {};
  const guilds = battle?.guilds || battle?.Guilds || {};
  const playerCount = typeof players === 'object' ? Object.keys(players).length : asNumber(players);

  const ourGuild = guilds?.[gid] || {};
  const ourKills = asNumber(ourGuild?.kills);
  const ourDeaths = asNumber(ourGuild?.deaths);
  const ourFame = asNumber(ourGuild?.killFame);

  const start = battle?.startTime || battle?.StartTime;
  const end = battle?.endTime || battle?.EndTime;
  const durationMin =
    start && end ? Math.max(1, Math.round((new Date(end) - new Date(start)) / 60000)) : null;

  const win = ourKills >= ourDeaths;
  const embed = new EmbedBuilder()
    .setColor(win ? 0x16a34a : 0xdc2626)
    .setAuthor({ name: 'Battleboard • I V E N U M I' })
    .setTitle(`${win ? '🏆' : '🩸'} Batalha em grande escala`)
    .addFields(
      {
        name: 'I V E N U M I',
        value: `Kills: **${fmt(ourKills)}**\nMortes: **${fmt(ourDeaths)}**\nFama: **${fmt(ourFame)}**`,
        inline: true,
      },
      {
        name: '🌍 Total',
        value: `Kills: **${fmt(totalKills)}**\nJogadores: **${fmt(playerCount)}**\nFama: **${fmt(totalFame)}**`,
        inline: true,
      }
    )
    .setFooter({ text: 'Albion • Battleboard' })
    .setTimestamp(new Date(start || Date.now()));

  if (durationMin) {
    embed.addFields({ name: '⏱️ Duração', value: `${durationMin} min`, inline: true });
  }
  if (id) embed.setURL(`${KILLBOARD_URL}/battles/${id}`);
  return embed;
}

export async function pollBattleboard(client) {
  const channelId = config.battleboardChannelId || config.killboardChannelId;
  const gid = config.albionGuildId;
  if (!channelId || !gid) return;
  if (!(await isModuleEnabled('battleboard_enabled'))) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const battles = await fetchGuildBattles();
  if (!battles.length) return;

  if (!battleWarmed) {
    for (const b of battles) {
      const id = String(b?.id || b?.Id || '');
      if (id) seenBattleIds.add(id);
    }
    battleWarmed = true;
    return;
  }

  const fresh = battles.filter((b) => {
    const id = String(b?.id || b?.Id || '');
    return id && !seenBattleIds.has(id);
  });

  for (const battle of fresh.slice(0, 3)) {
    const id = String(battle?.id || battle?.Id || '');
    await channel.send({ embeds: [buildBattleEmbed(battle, gid)] }).catch(() => null);
    seenBattleIds.add(id);
  }
}

export function startKillboardPoller(client) {
  if (!config.killboardChannelId || !config.albionGuildId) {
    console.warn('[Celeste D.] Killboard desativado (canal/guild id ausente)');
    return;
  }
  pollKillboard(client);
  setInterval(() => pollKillboard(client), config.killboardPollMs);
}

export function startBattleboardPoller(client) {
  if (!config.albionGuildId) return;
  pollBattleboard(client);
  setInterval(() => pollBattleboard(client), config.battleboardPollMs);
}
