import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { buildMissionEmbed } from './commands.js';

let supabase = null;
const notified = new Set();

function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  if (!supabase) supabase = createClient(config.supabaseUrl, config.supabaseKey);
  return supabase;
}

export async function pollNewMissions(client) {
  const db = getSupabase();
  const channelId = config.missionsChannelId;
  if (!db || !channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const { data: missions, error } = await db
    .from('missions')
    .select('id, title, description, points_reward, discord_notified, status')
    .eq('status', 'active')
    .eq('discord_notified', false)
    .limit(5);

  if (error || !missions?.length) return;

  for (const mission of missions) {
    if (notified.has(mission.id)) continue;

    const embed = buildMissionEmbed({
      title: mission.title,
      description: mission.description || 'Sem descrição',
      points: mission.points_reward || 0,
    });

    await channel.send({ embeds: [embed] });
    await db.from('missions').update({ discord_notified: true }).eq('id', mission.id);
    notified.add(mission.id);
    console.log(`[Celeste D.] Missão anunciada: ${mission.title}`);
  }
}

export function startMissionPoller(client) {
  if (!getSupabase() || !config.missionsChannelId) {
    console.warn('[Celeste D.] Poll de missões desativado (Supabase ou canal não configurado)');
    return;
  }
  pollNewMissions(client);
  setInterval(() => pollNewMissions(client), config.missionPollMs);
}
