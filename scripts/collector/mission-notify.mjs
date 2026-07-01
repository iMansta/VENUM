import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, DISCORD_WEBHOOK_MISSIONS } from './config.mjs';
import { notifyMissionCreated } from './discord.mjs';

/**
 * Envia missões novas/ativas para Discord (fila discord_notified = false).
 */
export async function syncMissionNotifications() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { sent: 0 };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: missions, error } = await supabase
    .from('missions')
    .select('*')
    .eq('status', 'active')
    .eq('discord_notified', false)
    .limit(10);

  if (error) {
    if (error.code === '42703') {
      console.warn('[MISSIONS] Coluna discord_notified ausente — aplique UPDATE_PHASE2.sql');
      return { sent: 0 };
    }
    throw error;
  }

  let sent = 0;
  for (const mission of missions || []) {
    const ok = await notifyMissionCreated(mission, DISCORD_WEBHOOK_MISSIONS);
    if (ok) {
      await supabase
        .from('missions')
        .update({ discord_notified: true })
        .eq('id', mission.id);
      sent++;
    }
  }

  if (sent > 0) console.log(`[MISSIONS] ${sent} missão(ões) enviada(s) ao Discord`);
  return { sent };
}
