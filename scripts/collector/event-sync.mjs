import { createClient } from '@supabase/supabase-js';
import {
  GAMEINFO_BASE,
  GUILD_NAME,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  DISCORD_WEBHOOK_EVENTS,
} from './config.mjs';
import { notifyGuildEvent } from './discord.mjs';

/** Palavras-chave para categorizar eventos (missões futuras). */
const ACTIVITY_KEYWORDS = {
  crystal_spider: ['CRYSTALSPIDER', 'CRYSTAL SPIDER', 'SPIDER'],
  mage_raid: ['MORGANA', 'MAGE', 'RAID'],
  outpost: ['OUTPOST', 'TOWER'],
  orb: ['ORB', 'CARRY'],
  vortex: ['VORTEX', 'HELLGATE'],
};

function classifyEvent(event) {
  const blob = JSON.stringify(event).toUpperCase();
  for (const [type, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
    if (keywords.some((k) => blob.includes(k))) return type;
  }
  return 'pvp_kill';
}

export async function syncGameEvents() {
  const res = await fetch(`${GAMEINFO_BASE}/events?limit=51&offset=0`);
  if (!res.ok) throw new Error(`GameInfo events: ${res.status}`);
  const events = await res.json();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log(`[EVENT SYNC] ${events.length} eventos (sem persistência Supabase)`);
    return { processed: events.length };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let inserted = 0;

  for (const ev of events.slice(0, 20)) {
    const eventId = ev.EventId || ev.KillId || ev.id;
    if (!eventId) continue;

    const activityType = classifyEvent(ev);

    const { error } = await supabase.from('guild_activity_log').upsert(
      {
        external_event_id: String(eventId),
        activity_type: activityType,
        payload: ev,
        guild_name: GUILD_NAME,
      },
      { onConflict: 'external_event_id', ignoreDuplicates: true }
    );

    if (!error) inserted++;

    if (DISCORD_WEBHOOK_EVENTS && activityType !== 'pvp_kill') {
      await notifyGuildEvent(
        {
          summary: `Atividade: ${activityType.replace('_', ' ')}`,
          fields: [
            { name: 'Event ID', value: String(eventId), inline: true },
            { name: 'Tipo', value: activityType, inline: true },
          ],
        },
        DISCORD_WEBHOOK_EVENTS
      );
    }
  }

  console.log(`[EVENT SYNC] Processados: ${events.length}, novos: ${inserted}`);
  return { processed: events.length, inserted };
}
