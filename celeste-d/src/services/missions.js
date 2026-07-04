import { createClient } from '@supabase/supabase-js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';
import { buildMissionEmbed } from '../commands.js';
import { isModuleEnabled } from './settings.js';

let supabase = null;
const notified = new Set();
const closedButtons = new Set();

function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  if (!supabase) supabase = createClient(config.supabaseUrl, config.supabaseKey);
  return supabase;
}

export async function pollNewMissions(client) {
  const db = getSupabase();
  const channelId = config.missionsChannelId;
  if (!db || !channelId) return;
  if (!(await isModuleEnabled('missions_enabled'))) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const { data: missions, error } = await db
    .from('missions')
    .select(
      'id, title, description, points_reward, discord_notified, status, end_date, target_item, target_quantity, current_quantity, mission_type, discord_message_id, discord_channel_id'
    )
    .eq('status', 'active')
    .or('discord_notified.eq.false,discord_notified.is.null')
    .limit(5);

  if (error || !missions?.length) return;

  for (const mission of missions) {
    if (notified.has(mission.id)) continue;

    const embed = buildMissionEmbed({
      title: mission.title,
      description: mission.description || 'Sem descrição',
      points: mission.points_reward || 0,
      hubUrl: config.hubUrl,
      missionType: mission.mission_type,
      targetItem: mission.target_item,
      targetQuantity: mission.target_quantity,
    });

    const msg = await channel.send({
      embeds: [embed],
      components: [missionActionRow(mission.id)],
    });
    await db
      .from('missions')
      .update({
        discord_notified: true,
        discord_message_id: msg.id,
        discord_channel_id: msg.channelId,
      })
      .eq('id', mission.id);
    notified.add(mission.id);
    console.log(`[Celeste D.] Missão anunciada: ${mission.title}`);
  }

  await disableClosedMissionButtons(client, db);
}

export function startMissionPoller(client) {
  if (!getSupabase() || !config.missionsChannelId) {
    console.warn('[Celeste D.] Poll de missões desativado (Supabase ou canal não configurado)');
    return;
  }
  pollNewMissions(client);
  setInterval(() => pollNewMissions(client), config.missionPollMs);
}

const missionActionRow = (missionId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mission:${missionId}:join`)
      .setLabel('Participar')
      .setStyle(ButtonStyle.Success)
  );

const normalize = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

async function resolveProfileForDiscord(db, interaction) {
  const discordUserId = interaction.user.id;
  const discordAvatarUrl =
    typeof interaction.user.displayAvatarURL === 'function'
      ? interaction.user.displayAvatarURL({ extension: 'png', size: 256 })
      : null;
  const byDiscord = await db
    .from('profiles')
    .select('id, username, albion_character_name, discord_user_id, avatar_url')
    .eq('discord_user_id', discordUserId)
    .maybeSingle();
  if (byDiscord?.data?.id) {
    if (discordAvatarUrl && byDiscord.data.avatar_url !== discordAvatarUrl) {
      await db.from('profiles').update({ avatar_url: discordAvatarUrl }).eq('id', byDiscord.data.id);
      byDiscord.data.avatar_url = discordAvatarUrl;
    }
    return byDiscord.data;
  }

  const candidates = [
    interaction.member?.displayName,
    interaction.user?.globalName,
    interaction.user?.username,
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  if (candidates.length === 0) return null;

  const { data: profiles } = await db
    .from('profiles')
    .select('id, username, albion_character_name, discord_user_id, avatar_url')
    .eq('is_active', true)
    .limit(5000);

  const candidateKeys = new Set(candidates.map(normalize));
  const matched = (profiles || []).find((p) => {
    const u = normalize(p.username);
    const a = normalize(p.albion_character_name);
    return candidateKeys.has(u) || (a && candidateKeys.has(a));
  });

  if (matched?.id && !matched.discord_user_id) {
    await db
      .from('profiles')
      .update({ discord_user_id: discordUserId, avatar_url: discordAvatarUrl || matched.avatar_url || null })
      .eq('id', matched.id);
    matched.discord_user_id = discordUserId;
    if (discordAvatarUrl) matched.avatar_url = discordAvatarUrl;
  } else if (matched?.id && discordAvatarUrl && matched.avatar_url !== discordAvatarUrl) {
    await db.from('profiles').update({ avatar_url: discordAvatarUrl }).eq('id', matched.id);
    matched.avatar_url = discordAvatarUrl;
  }

  return matched || null;
}

async function disableClosedMissionButtons(client, db) {
  const { data: rows, error } = await db
    .from('missions')
    .select('id, status, end_date, discord_message_id, discord_channel_id')
    .not('discord_message_id', 'is', null)
    .limit(100);

  if (error || !rows?.length) return;

  const now = Date.now();
  for (const mission of rows) {
    const endedByDate = mission.end_date ? new Date(mission.end_date).getTime() <= now : false;
    const shouldClose = mission.status !== 'active' || endedByDate;
    if (!shouldClose) continue;
    if (closedButtons.has(mission.id)) continue;

    const ch = await client.channels.fetch(mission.discord_channel_id || config.missionsChannelId).catch(() => null);
    if (!ch?.isTextBased()) continue;
    const msg = await ch.messages.fetch(mission.discord_message_id).catch(() => null);
    if (!msg) continue;

    await msg.edit({ components: [] }).catch(() => null);
    closedButtons.add(mission.id);
  }
}

export async function handleMissionButton(interaction) {
  const db = getSupabase();
  if (!db) {
    await interaction.reply({
      content: 'Integração com banco indisponível no momento.',
      ephemeral: true,
    });
    return;
  }

  const parts = String(interaction.customId || '').split(':');
  if (parts[0] !== 'mission' || parts[2] !== 'join') return;
  const missionId = parts[1];

  const { data: mission } = await db
    .from('missions')
    .select('id, status, title, end_date')
    .eq('id', missionId)
    .maybeSingle();

  if (!mission) {
    await interaction.reply({ content: 'Missão não encontrada.', ephemeral: true });
    return;
  }

  const endedByDate = mission.end_date ? new Date(mission.end_date).getTime() <= Date.now() : false;
  if (mission.status !== 'active' || endedByDate) {
    await interaction.reply({
      content: 'Essa missão já foi encerrada. O botão foi desativado.',
      ephemeral: true,
    });
    return;
  }

  const profile = await resolveProfileForDiscord(db, interaction);
  if (!profile?.id) {
    await interaction.reply({
      content:
        'Não consegui vincular seu Discord ao cadastro da guilda. Use o mesmo nickname do site no Discord e tente novamente.',
      ephemeral: true,
    });
    return;
  }

  const { error } = await db.from('mission_participants').upsert(
    {
      mission_id: missionId,
      profile_id: profile.id,
      contribution_quantity: 0,
    },
    { onConflict: 'mission_id,profile_id' }
  );

  if (error) {
    await interaction.reply({
      content: `Falha ao registrar participação: ${error.message}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `Você entrou na missão **${mission.title}**. O progresso será contabilizado automaticamente pela Anaconda.`,
    ephemeral: true,
  });
}
