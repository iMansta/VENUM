import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Lê as flags de controle do bot (tabela celeste_bot_settings, linha id=1)
 * com cache curto. Permite ligar/desligar o bot e módulos pelo painel web
 * sem reiniciar o processo.
 */

let supabase = null;
let cache = null;
let cacheAt = 0;
const TTL_MS = 30_000;

const DEFAULTS = {
  enabled: true,
  missions_enabled: true,
  announcements_enabled: true,
  killboard_enabled: true,
  battleboard_enabled: true,
  content_enabled: true,
};

function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  if (!supabase) supabase = createClient(config.supabaseUrl, config.supabaseKey);
  return supabase;
}

export async function getBotSettings() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;

  const db = getSupabase();
  if (!db) return { ...DEFAULTS };

  try {
    const { data, error } = await db
      .from('celeste_bot_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    cache = { ...DEFAULTS, ...(data || {}) };
    cacheAt = now;
    return cache;
  } catch (err) {
    console.warn('[Celeste D.] Falha ao ler settings, usando defaults:', err.message);
    return cache || { ...DEFAULTS };
  }
}

/**
 * Retorna true se o bot está ativo E o módulo indicado está habilitado.
 */
export async function isModuleEnabled(moduleKey) {
  const s = await getBotSettings();
  if (!s.enabled) return false;
  if (!moduleKey) return true;
  return s[moduleKey] !== false;
}
