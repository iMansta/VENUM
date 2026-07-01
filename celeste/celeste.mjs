import 'dotenv/config';
import { CELESTE_INTERVAL_MS, GUILD_SYNC_INTERVAL_MS } from './lib/config.mjs';
import { syncMarketPrices } from './lib/price-sync.mjs';
import { syncGameEvents } from './lib/event-sync.mjs';
import { syncGuildMembers } from './lib/guild-sync.mjs';
import { syncMissionNotifications } from './lib/mission-notify.mjs';

const runOnce = process.argv.includes('--once');
let lastGuildSync = 0;

async function runCycle() {
  const started = Date.now();
  console.log(`\n[CELESTE] Ciclo ${new Date().toLocaleString('pt-BR')}`);

  try {
    await syncMarketPrices();
  } catch (e) {
    console.error('[CELESTE] preços:', e.message);
  }

  try {
    await syncGameEvents();
  } catch (e) {
    console.error('[CELESTE] eventos:', e.message);
  }

  try {
    await syncMissionNotifications();
  } catch (e) {
    console.error('[CELESTE] missões:', e.message);
  }

  const now = Date.now();
  if (now - lastGuildSync >= GUILD_SYNC_INTERVAL_MS) {
    try {
      await syncGuildMembers();
      lastGuildSync = now;
    } catch (e) {
      console.error('[CELESTE] guilda:', e.message);
    }
  }

  console.log(`[CELESTE] Concluído em ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

console.log('');
console.log('  ♪ Celeste — I V E N U M I ♪');
console.log('  Sincronizando mercado, guilda e missões...');
console.log('');

await runCycle();

if (!runOnce) {
  const mins = Math.round(CELESTE_INTERVAL_MS / 60000);
  console.log(`[CELESTE] Próximo ciclo em ${mins} min (Ctrl+C para parar)`);
  setInterval(runCycle, CELESTE_INTERVAL_MS);
}
