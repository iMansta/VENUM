import { createClient } from '@supabase/supabase-js';
import { GAMEINFO_BASE, GUILD_NAME, SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.mjs';

export async function syncGameEvents() {
  const res = await fetch(`${GAMEINFO_BASE}/events?limit=20&offset=0`);
  if (!res.ok) throw new Error(`Eventos: ${res.status}`);
  const events = await res.json();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log(`[CELESTE] ${events.length} eventos (sem persistência)`);
    return { processed: events.length };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let inserted = 0;

  for (const ev of events.slice(0, 10)) {
    const eventId = ev.EventId || ev.KillId || ev.id;
    if (!eventId) continue;

    const { error } = await supabase.from('guild_activity_log').upsert(
      {
        external_event_id: String(eventId),
        activity_type: 'pvp_kill',
        payload: ev,
        guild_name: GUILD_NAME,
      },
      { onConflict: 'external_event_id', ignoreDuplicates: true }
    );

    if (!error) inserted++;
  }

  console.log(`[CELESTE] Eventos: ${inserted} novos`);
  return { inserted };
}
