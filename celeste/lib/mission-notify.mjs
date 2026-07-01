import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, DISCORD_WEBHOOK_MISSIONS } from './config.mjs';
import { notifyMissionCreated } from './discord.mjs';

export async function syncMissionNotifications() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { sent: 0 };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: missions, error } = await supabase
    .from('missions')
    .select('*')
    .eq('status', 'active')
    .limit(10);

  if (error) return { sent: 0 };

  let sent = 0;
  for (const mission of missions || []) {
    if (mission.discord_notified) continue;
    const ok = await notifyMissionCreated(mission, DISCORD_WEBHOOK_MISSIONS);
    if (ok) {
      await supabase.from('missions').update({ discord_notified: true }).eq('id', mission.id);
      sent++;
    }
  }

  if (sent > 0) console.log(`[CELESTE] ${sent} missão(ões) no Discord`);
  return { sent };
}
