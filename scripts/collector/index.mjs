#!/usr/bin/env node
/**
 * VENUM Coletor — roda em segundo plano (estilo serviço Next/cron).
 *
 * Uso:
 *   npm run collector          # loop contínuo
 *   npm run collector:once     # uma execução
 *
 * Tarefas:
 *   • Sync preços (catálogo → API só valores)
 *   • Sync eventos GameInfo (base para missões)
 *   • Notificar missões no Discord
 *   • Validar membros da guilda 1×/dia
 */
import 'dotenv/config';
import {
  COLLECTOR_INTERVAL_MS,
  GUILD_SYNC_INTERVAL_MS,
} from './config.mjs';
import { syncMarketPrices } from './price-sync.mjs';
import { syncGameEvents } from './event-sync.mjs';
import { syncGuildMembers } from './guild-sync.mjs';
import { syncMissionNotifications } from './mission-notify.mjs';

const runOnce = process.argv.includes('--once');
let lastGuildSync = 0;

async function runCycle() {
  const started = Date.now();
  console.log(`\n[COLLECTOR] Ciclo iniciado ${new Date().toISOString()}`);

  try {
    await syncMarketPrices();
  } catch (e) {
    console.error('[COLLECTOR] price-sync:', e.message);
  }

  try {
    await syncGameEvents();
  } catch (e) {
    console.error('[COLLECTOR] event-sync:', e.message);
  }

  try {
    await syncMissionNotifications();
  } catch (e) {
    console.error('[COLLECTOR] mission-notify:', e.message);
  }

  const now = Date.now();
  if (now - lastGuildSync >= GUILD_SYNC_INTERVAL_MS) {
    try {
      await syncGuildMembers();
      lastGuildSync = now;
    } catch (e) {
      console.error('[COLLECTOR] guild-sync:', e.message);
    }
  }

  console.log(`[COLLECTOR] Ciclo concluído em ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

await runCycle();

if (!runOnce) {
  console.log(`[COLLECTOR] Próximo ciclo em ${COLLECTOR_INTERVAL_MS / 60000} min`);
  setInterval(runCycle, COLLECTOR_INTERVAL_MS);
}
