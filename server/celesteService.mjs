/**
 * Celeste — sync server-side (service_role só na Vercel).
 */
import { createClient } from '@supabase/supabase-js';

const GUILD_NAME = process.env.GUILD_NAME || 'I V E N U M I';
const ALBION_DATA_BASE =
  process.env.VITE_ALBION_DATA_BASE || 'https://west.albion-online-data.com';
const GAMEINFO_BASE =
  process.env.VITE_GAMEINFO_BASE || 'https://gameinfo.albiononline.com/api/gameinfo';
const ROYAL_CITIES = ['Martlock', 'Thetford', 'Fort Sterling', 'Lymhurst', 'Bridgewatch'];
const BM_CITY = 'Caerleon';

const FALLBACK_ITEMS = [
  'T4_MAIN_SWORD', 'T5_MAIN_SWORD', 'T6_MAIN_SWORD', 'T7_MAIN_SWORD', 'T8_MAIN_SWORD',
  'T4_BAG', 'T5_BAG', 'T6_BAG', 'T7_BAG', 'T8_BAG',
  'T4_CAPE', 'T5_CAPE', 'T6_CAPE', 'T7_CAPE', 'T8_CAPE',
];

const normalizeGuild = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel');
  }
  return createClient(url, key);
}

const safeCount = async (promiseFactory) => {
  try {
    const { count, error } = await promiseFactory();
    if (error) return null;
    return Number(count || 0);
  } catch {
    return null;
  }
};

export function verifyCelesteAgent(req) {
  const expected = process.env.CELESTE_AGENT_TOKEN;
  if (!expected) {
    return { ok: false, status: 503, error: 'CELESTE_AGENT_TOKEN não configurado no servidor' };
  }

  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const alt = req.headers?.['x-celeste-token'] || req.headers?.['X-Celeste-Token'] || '';
  const token = bearer || alt;

  if (!token || token !== expected) {
    return { ok: false, status: 401, error: 'Token Celeste inválido' };
  }
  return { ok: true };
}

export async function celestePing() {
  getSupabaseAdmin();
  return {
    ok: true,
    guild: GUILD_NAME,
    version: '1.0.0',
    serverTime: new Date().toISOString(),
  };
}

export async function getCatalogItemIds() {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc('get_arbitrage_catalog_item_ids', {
      p_min_tier: 4,
      p_max_tier: 8,
      p_limit: 500,
    });
    if (!error && data?.length) {
      return data.map((r) => r.item_id || r).filter(Boolean);
    }
  } catch {
    /* fallback */
  }

  try {
    const { data: rows } = await supabase
      .from('market_items')
      .select('item_id')
      .gte('tier', 4)
      .lte('tier', 8)
      .limit(500);
    if (rows?.length) return rows.map((r) => r.item_id).filter(Boolean);
  } catch {
    /* fallback */
  }

  return FALLBACK_ITEMS;
}

export async function upsertMarketPrices(rows) {
  const supabase = getSupabaseAdmin();
  let count = 0;

  for (const row of rows || []) {
    if (!row?.item_id || !row?.city) continue;
    const { error } = await supabase.rpc('set_cached_market_price_by_location', {
      p_item_id: row.item_id,
      p_location: row.city,
      p_price_data: {
        buy_price_min: row.buy_price_min,
        buy_price_max: row.buy_price_max,
        sell_price_min: row.sell_price_min,
        sell_price_max: row.sell_price_max,
      },
    });
    if (!error) count += 1;
  }

  return { rows: count };
}

export async function aggregateCelesteObservations(limit = 500) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('process_celeste_observations', {
    p_limit: limit,
  });

  if (error) {
    // Mantém compatibilidade enquanto SQL novo não for aplicado.
    return { skipped: true, reason: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    processed: Number(row?.processed || 0),
    missionUpdates: Number(row?.mission_updates || 0),
    fameUpdates: Number(row?.fame_updates || 0),
    missionsCompleted: Number(row?.missions_completed || 0),
  };
}

export async function syncGuildMembers() {
  const supabase = getSupabaseAdmin();

  const searchRes = await fetch(`${GAMEINFO_BASE}/search?q=${encodeURIComponent(GUILD_NAME)}`);
  if (!searchRes.ok) throw new Error(`GameInfo search ${searchRes.status}`);
  const searchData = await searchRes.json();
  const guild = (searchData.guilds || []).find(
    (g) => normalizeGuild(g.Name) === normalizeGuild(GUILD_NAME)
  );
  if (!guild) throw new Error(`Guilda "${GUILD_NAME}" não encontrada`);

  const membersRes = await fetch(`${GAMEINFO_BASE}/guilds/${guild.Id}/members`);
  if (!membersRes.ok) throw new Error(`GameInfo members ${membersRes.status}`);
  const members = await membersRes.json();
  const memberNames = new Set((members || []).map((m) => String(m.Name || '').toLowerCase()));

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, role, is_active');

  if (error) throw error;

  let activated = 0;
  let deactivated = 0;

  for (const profile of profiles || []) {
    const charName = (profile.username || '').toLowerCase();
    if (!charName || profile.role === 'admin') continue;

    const inGuild = memberNames.has(charName);

    if (inGuild && profile.is_active === false) {
      await supabase.from('profiles').update({ is_active: true }).eq('id', profile.id);
      activated += 1;
    } else if (!inGuild && profile.is_active !== false) {
      await supabase.from('profiles').update({ is_active: false }).eq('id', profile.id);
      deactivated += 1;
    }
  }

  return { memberCount: memberNames.size, activated, deactivated };
}

export async function syncGameEvents() {
  const supabase = getSupabaseAdmin();
  const res = await fetch(`${GAMEINFO_BASE}/events?limit=20&offset=0`);
  if (!res.ok) throw new Error(`Eventos ${res.status}`);
  const events = await res.json();

  let inserted = 0;
  for (const ev of (events || []).slice(0, 10)) {
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

    if (!error) inserted += 1;
  }

  return { inserted, total: events?.length || 0 };
}

export async function syncMissionNotifications() {
  const webhook =
    process.env.DISCORD_WEBHOOK_MISSIONS || process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return { sent: 0, skipped: 'no_webhook' };

  const supabase = getSupabaseAdmin();
  const { data: missions, error } = await supabase
    .from('missions')
    .select('*')
    .eq('status', 'active')
    .limit(10);

  if (error) throw error;

  let sent = 0;
  for (const mission of missions || []) {
    if (mission.discord_notified) continue;

    const embed = {
      title: '🎯 Nova Missão — I V E N U M I',
      description: mission.description || mission.title,
      color: 0xeab308,
      fields: [
        { name: 'Missão', value: mission.title || '—', inline: false },
        { name: 'Recompensa', value: `${mission.points_reward || 0} pontos`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };

    const discordRes = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (discordRes.ok) {
      await supabase.from('missions').update({ discord_notified: true }).eq('id', mission.id);
      sent += 1;
    }
  }

  return { sent };
}

/** Catálogo + locations para o cliente buscar preços na Albion Data API. */
export async function getCatalogBundle() {
  const itemIds = await getCatalogItemIds();
  const locations = [...ROYAL_CITIES, BM_CITY];
  return { itemIds, locations, batchSize: 40 };
}

export function getAlbionPriceUrl(itemIds, locations) {
  const loc = (locations || [...ROYAL_CITIES, BM_CITY]).join(',');
  return `${ALBION_DATA_BASE}/api/v2/stats/prices/${itemIds.join(',')}.json?locations=${loc}&qualities=1`;
}

export async function runFullServerSync() {
  const results = {};
  results.guild = await syncGuildMembers();
  results.events = await syncGameEvents();
  results.missions = await syncMissionNotifications();
  return results;
}

export async function getCelesteOperationalStatus() {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const since15m = new Date(now - 15 * 60 * 1000).toISOString();
  const since1h = new Date(now - 60 * 60 * 1000).toISOString();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [online15m, obs1h, pendingObs, activeMissions, completedToday, reservations] =
    await Promise.all([
      safeCount(() =>
        supabase
          .from('celeste_clients')
          .select('client_id', { count: 'exact', head: true })
          .gte('last_seen_at', since15m)
      ),
      safeCount(() =>
        supabase
          .from('celeste_observations')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since1h)
      ),
      safeCount(() =>
        supabase
          .from('celeste_observations')
          .select('id', { count: 'exact', head: true })
          .is('processed_at', null)
      ),
      safeCount(() =>
        supabase
          .from('missions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
      ),
      safeCount(() =>
        supabase
          .from('missions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('updated_at', since24h)
      ),
      safeCount(() =>
        supabase
          .from('transport_reservations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'reserved')
      ),
    ]);

  let latestClient = null;
  try {
    const { data } = await supabase
      .from('celeste_clients')
      .select('client_id, host_name, app_version, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    latestClient = data || null;
  } catch {
    latestClient = null;
  }

  const supabaseHost = (() => {
    try {
      return new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).host;
    } catch {
      return null;
    }
  })();

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    guild: GUILD_NAME,
    supabaseHost,
    telemetry: {
      onlineClients15m: online15m,
      observationsLast1h: obs1h,
      pendingObservations: pendingObs,
      latestClient,
    },
    app: {
      activeMissions,
      missionsCompleted24h: completedToday,
      reservedTransports: reservations,
    },
  };
}

/**
 * Coleta de telemetria local do cliente Celeste (logs do jogo).
 * Mantém payload bruto para evoluir regras sem perder histórico.
 */
export async function ingestCelesteTelemetry(payload = {}) {
  const supabase = getSupabaseAdmin();
  const clientId = String(payload.clientId || '').trim();
  const observations = Array.isArray(payload.observations) ? payload.observations : [];
  const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};

  if (!clientId) {
    throw new Error('clientId obrigatório');
  }

  const now = new Date().toISOString();

  await supabase.from('celeste_clients').upsert(
    {
      client_id: clientId,
      last_seen_at: now,
      app_version: String(meta.version || ''),
      host_name: String(meta.hostName || ''),
      game_log_path: String(meta.gameLogPath || ''),
      guild_name: GUILD_NAME,
    },
    { onConflict: 'client_id' }
  );

  if (observations.length === 0) {
    return { clientId, inserted: 0 };
  }

  const capped = observations.slice(0, 200).map((obs) => ({
    client_id: clientId,
    observed_at: obs.observedAt || now,
    type: String(obs.type || 'raw'),
    value_numeric:
      Number.isFinite(Number(obs.valueNumeric)) ? Number(obs.valueNumeric) : null,
    payload: obs.payload && typeof obs.payload === 'object' ? obs.payload : { raw: String(obs.raw || '') },
  }));

  const { error } = await supabase.from('celeste_observations').insert(capped);
  if (error) throw error;

  const aggregate = await aggregateCelesteObservations(800);

  return { clientId, inserted: capped.length, aggregate };
}
