/**
 * Celeste — sync server-side (service_role só na Vercel).
 */
import { createClient } from '@supabase/supabase-js';

const GUILD_NAME = process.env.GUILD_NAME || 'I V E N U M I';
const ALBION_DATA_BASE =
  process.env.VITE_ALBION_DATA_BASE || 'https://west.albion-online-data.com';
const GAMEINFO_BASE =
  process.env.VITE_GAMEINFO_BASE || 'https://gameinfo.albiononline.com/api/gameinfo';
const ALBION_GUILD_ID = process.env.ALBION_GUILD_ID || '-TW40MAhRHGsv3ow5h_Zdw';
const ROYAL_CITIES = ['Martlock', 'Thetford', 'Fort Sterling', 'Lymhurst', 'Bridgewatch'];
const BM_CITY = 'Caerleon';
const ALBION_RENDER_BUCKET = process.env.ALBION_RENDER_BUCKET || 'albion-render-assets';

const FALLBACK_ITEMS = [
  'T4_MAIN_SWORD', 'T5_MAIN_SWORD', 'T6_MAIN_SWORD', 'T7_MAIN_SWORD', 'T8_MAIN_SWORD',
  'T4_BAG', 'T5_BAG', 'T6_BAG', 'T7_BAG', 'T8_BAG',
  'T4_CAPE', 'T5_CAPE', 'T6_CAPE', 'T7_CAPE', 'T8_CAPE',
];

const canonicalizeItemId = (itemId) => {
  const raw = String(itemId || '').trim();
  if (!raw) return '';
  const [base, enchantment] = raw.split('@');
  const canonical = base
    .replace(/^T(\d+)_MAIN_BOW$/, 'T$1_2H_BOW')
    .replace(/^T(\d+)_MAIN_CROSSBOW$/, 'T$1_2H_CROSSBOW')
    .replace(/^T(\d+)_MAIN_QUARTERSTAFF$/, 'T$1_2H_QUARTERSTAFF')
    .replace(/^T(\d+)_OFF_HORN$/, 'T$1_OFF_HORN_KEEPER')
    .replace(/^T(\d+)_OFF_ORB$/, 'T$1_OFF_ORB_MORGANA')
    .replace(/^T(\d+)_MOUNT_ARMOREDHORSE$/, 'T$1_MOUNT_ARMORED_HORSE')
    .replace(/^T(\d+)_HEAD_(CLOTH|LEATHER|PLATE)$/, 'T$1_HEAD_$2_SET1')
    .replace(/^T(\d+)_ARMOR_(CLOTH|LEATHER|PLATE)$/, 'T$1_ARMOR_$2_SET1')
    .replace(/^T(\d+)_SHOES_(CLOTH|LEATHER|PLATE)$/, 'T$1_SHOES_$2_SET1');
  return enchantment ? `${canonical}@${enchantment}` : canonical;
};

const normalizeGuild = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();
const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const toNullableNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const albionRenderAssetUrl = (type, identifier) => {
  const id = String(identifier || '').trim();
  if (!id) return null;
  return `/api/albion-render?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
};

const normalizeAlbionRenderUrl = (value, type, fallbackId = '') => {
  const raw = String(value || '').trim();
  if (raw.startsWith('/api/albion-render')) return raw;

  const match = raw.match(
    /^https:\/\/render\.albiononline\.com\/v1\/(item|spell|wardrobe|destiny)\/([^/?#]+)\.png/i
  );
  if (match) {
    return albionRenderAssetUrl(match[1].toLowerCase(), decodeURIComponent(match[2]));
  }

  if (!raw && fallbackId) {
    return albionRenderAssetUrl(type, fallbackId);
  }

  return raw || null;
};

const normalizeSkillIcons = (skills = []) => {
  if (!Array.isArray(skills)) return { value: [], changed: false };

  let changed = false;
  const value = skills.map((skill) => {
    if (!skill || typeof skill !== 'object') return skill;
    const nextIcon = normalizeAlbionRenderUrl(skill.icon_url, 'spell', skill.key);
    if (nextIcon !== (skill.icon_url || null)) {
      changed = true;
      return { ...skill, icon_url: nextIcon };
    }
    return skill;
  });

  return { value, changed };
};

async function fetchJsonWithRetry(url, { attempts = 3, timeoutMs = 20000 } = {}) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        clearTimeout(timer);
        return await res.json();
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (i < attempts - 1) {
      await sleep(800 * (i + 1));
    }
  }
  throw lastError || new Error('Falha ao consultar Albion API');
}

const missionTargetMatches = (targetItem, accepted = []) => {
  const t = String(targetItem || '').trim().toLowerCase();
  if (!t || t === 'any' || t === 'general') return true;
  return accepted.includes(t);
};

async function applyMissionContributionDelta({
  supabase,
  profileId,
  missionType,
  acceptedTargets,
  delta,
}) {
  if (!profileId || !delta || delta <= 0) return 0;

  const { data: missions, error } = await supabase
    .from('missions')
    .select('id, target_item, target_quantity, current_quantity')
    .eq('status', 'active')
    .eq('mission_type', missionType)
    .or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`);

  if (error || !missions?.length) return 0;

  let updates = 0;
  for (const mission of missions) {
    if (!missionTargetMatches(mission.target_item, acceptedTargets)) continue;
    const nextQty = Math.min(
      toNumber(mission.target_quantity),
      toNumber(mission.current_quantity) + delta
    );
    const { error: upErr } = await supabase
      .from('missions')
      .update({ current_quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', mission.id);
    if (upErr) continue;
    updates += 1;

    const { data: existing } = await supabase
      .from('mission_participants')
      .select('id, contribution_quantity')
      .eq('mission_id', mission.id)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('mission_participants')
        .update({
          contribution_quantity: toNumber(existing.contribution_quantity) + delta,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('mission_participants').insert({
        mission_id: mission.id,
        profile_id: profileId,
        contribution_quantity: delta,
      });
    }
  }

  return updates;
}

async function getActivePveMissionThresholds(supabase) {
  const { data, error } = await supabase
    .from('missions')
    .select('id, title, mission_type, target_item, min_fame_threshold, end_date')
    .eq('status', 'active')
    .eq('mission_type', 'pve')
    .in('target_item', ['mob_kill', 'kill', 'pve_kill'])
    .or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`);

  if (error || !data?.length) return [];

  return data.map((mission) => ({
    id: mission.id,
    title: mission.title,
    targetItem: mission.target_item,
    minFameThreshold: Number(mission.min_fame_threshold) > 0
      ? Number(mission.min_fame_threshold)
      : 10000,
    endDate: mission.end_date || null,
  }));
}

async function getPlayerPveMissionThresholds(supabase, username) {
  const user = String(username || '').trim();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .or(`username.ilike.${user},albion_character_name.ilike.${user}`)
    .limit(1)
    .maybeSingle();
  if (!profile?.id) return [];

  const { data, error } = await supabase
    .from('mission_participants')
    .select(`
      mission_id,
      missions!inner (
        id,
        title,
        mission_type,
        target_item,
        min_fame_threshold,
        end_date,
        status
      )
    `)
    .eq('profile_id', profile.id)
    .eq('missions.status', 'active')
    .eq('missions.mission_type', 'pve')
    .in('missions.target_item', ['mob_kill', 'kill', 'pve_kill'])
    .or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`, {
      foreignTable: 'missions',
    });

  if (error || !data?.length) return [];

  return data
    .map((row) => row.missions)
    .filter(Boolean)
    .map((mission) => ({
      id: mission.id,
      title: mission.title,
      targetItem: mission.target_item,
      minFameThreshold: Number(mission.min_fame_threshold) > 0
        ? Number(mission.min_fame_threshold)
        : 10000,
      endDate: mission.end_date || null,
    }));
}

async function syncGuildMetricsSnapshot({
  supabase,
  guildId,
  guildName,
  memberCount,
  overrides = {},
}) {
  let detail = null;
  try {
    detail = await fetchJsonWithRetry(`${GAMEINFO_BASE}/guilds/${guildId}`, {
      attempts: 2,
      timeoutMs: 12000,
    });
  } catch {
    detail = null;
  }

  // Último snapshot para carregar valores que a API pública não expõe de forma
  // confiável (prata da guild e pontos de temporada). Assim os cards não zeram
  // quando a GameInfo retorna null.
  let previous = null;
  try {
    const { data } = await supabase
      .from('guild_metrics_snapshots')
      .select(
        'silver_amount, season_points, alliance_tag, alliance_name, hideout_count, territory_count, headquarters'
      )
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    previous = data || null;
  } catch {
    previous = null;
  }

  const source = detail || {};
  const silverAmount =
    toNullableNumber(overrides.silverAmount) ??
    toNullableNumber(
      source.SilverAmount ??
        source.silverAmount ??
        source.Silver ??
        source.silver ??
        source.GuildSilver
    ) ??
    toNullableNumber(previous?.silver_amount);
  const seasonPoints =
    toNullableNumber(overrides.seasonPoints) ??
    toNullableNumber(
      source.SeasonPoints ??
        source.seasonPoints ??
        source.RankingPoints ??
        source.rankingPoints
    ) ??
    toNullableNumber(previous?.season_points);
  const killFame = toNullableNumber(source.KillFame ?? source.killFame);
  const deathFame = toNullableNumber(source.DeathFame ?? source.deathFame);
  const totalFame = toNullableNumber(source.Fame ?? source.fame ?? source.TotalFame);

  // Aliança
  const allianceTag =
    source.AllianceTag || source.allianceTag || previous?.alliance_tag || null;
  const allianceName =
    source.AllianceName || source.allianceName || previous?.alliance_name || null;

  // Propriedades da guild (Hideouts / Territórios / QG). A GameInfo nem sempre
  // expõe estes dados no detalhe da guild; coletamos de forma resiliente.
  const countOf = (v) => (Array.isArray(v) ? v.length : toNullableNumber(v));
  const hideoutCount =
    countOf(
      source.Hideouts ?? source.hideouts ?? source.HideoutCount ?? source.hideoutCount
    ) ?? toNullableNumber(previous?.hideout_count);
  const territoryCount =
    countOf(
      source.Territories ?? source.territories ?? source.TerritoryCount ?? source.territoryCount
    ) ?? toNullableNumber(previous?.territory_count);
  const headquarters =
    source.Headquarters ||
    source.HeadquartersName ||
    source.HQ ||
    (Array.isArray(source.Hideouts) && source.Hideouts[0]?.Name) ||
    previous?.headquarters ||
    null;

  const snapshot = {
    guild_id: guildId,
    guild_name: guildName || GUILD_NAME,
    member_count: toNumber(memberCount),
    silver_amount: silverAmount,
    season_points: seasonPoints,
    kill_fame: killFame,
    death_fame: deathFame,
    total_fame: totalFame,
    alliance_tag: allianceTag,
    alliance_name: allianceName,
    hideout_count: hideoutCount,
    territory_count: territoryCount,
    headquarters,
    properties: {
      hideouts: source.Hideouts ?? null,
      territories: source.Territories ?? null,
    },
    source: detail ? 'gameinfo_guild_detail' : 'guild_sync_fallback',
    payload: detail || null,
    collected_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('guild_metrics_snapshots').insert(snapshot);
  if (error) {
    return { ...snapshot, warning: error.message };
  }
  return snapshot;
}

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'Configure SUPABASE_URL e chave admin (SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY) na Vercel'
    );
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
      return [...new Set(data.map((r) => canonicalizeItemId(r.item_id || r)).filter(Boolean))];
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
    if (rows?.length) return [...new Set(rows.map((r) => canonicalizeItemId(r.item_id)).filter(Boolean))];
  } catch {
    /* fallback */
  }

  return [...new Set(FALLBACK_ITEMS.map(canonicalizeItemId).filter(Boolean))];
}

export async function upsertMarketPrices(rows) {
  const supabase = getSupabaseAdmin();
  let count = 0;

  const deduped = new Map();
  for (const row of rows || []) {
    const itemId = String(row?.item_id || '').trim();
    const city = String(row?.city || '').trim();
    if (!itemId || !city) continue;
    deduped.set(`${itemId}::${city}`, row);
    if (deduped.size >= 500) break; // trava de segurança para não saturar writes
  }

  const normalized = [...deduped.values()];
  const chunkSize = 25;

  let firstError = null;
  for (let i = 0; i < normalized.length; i += chunkSize) {
    const chunk = normalized.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map((row) =>
        supabase.rpc('set_cached_market_price_by_location', {
          p_item_id: row.item_id,
          p_location: row.city,
          p_price_data: {
            buy_price_min: row.buy_price_min,
            buy_price_max: row.buy_price_max,
            sell_price_min: row.sell_price_min,
            sell_price_max: row.sell_price_max,
            buy_price_min_date: row.buy_price_min_date,
            buy_price_max_date: row.buy_price_max_date,
            sell_price_min_date: row.sell_price_min_date,
            sell_price_max_date: row.sell_price_max_date,
          },
        })
      )
    );
    for (const res of results) {
      if (res.error) {
        if (!firstError) firstError = res.error;
        continue;
      }
      count += 1;
    }
  }

  if (count === 0 && normalized.length > 0 && firstError) {
    console.error('[celeste] upsertMarketPrices:', firstError.message || firstError);
  }

  return { rows: count, accepted: normalized.length, error: firstError?.message || null };
}

/** Busca preços na Albion Data API (servidor) e persiste no cache — fallback quando o cliente local falha. */
export async function syncMarketPricesFromAlbionData() {
  const itemIds = await getCatalogItemIds();
  const locations = [...ROYAL_CITIES, BM_CITY];
  const locParam = locations.join(',');
  const batchSize = 40;
  let total = 0;
  const batches = Math.max(1, Math.ceil(itemIds.length / batchSize));

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    const batchNo = Math.floor(i / batchSize) + 1;
    const url = `${ALBION_DATA_BASE}/api/v2/stats/prices/${batch.join(',')}.json?locations=${encodeURIComponent(locParam)}&qualities=1`;

    try {
      const prices = await fetchJsonWithRetry(url);
      const rows = (Array.isArray(prices) ? prices : []).filter((r) => r?.item_id && r?.city);
      if (!rows.length) {
        console.warn(`[celeste] prices-sync lote ${batchNo}/${batches}: nenhum preço válido`);
        continue;
      }
      const result = await upsertMarketPrices(rows);
      total += Number(result?.rows || 0);
    } catch (err) {
      console.warn(`[celeste] prices-sync lote ${batchNo}/${batches}:`, err?.message || err);
    }

    if (i + batchSize < itemIds.length) {
      await sleep(200);
    }
  }

  return { rows: total, batches, items: itemIds.length };
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

export async function syncGuildMembers(options = {}) {
  const supabase = getSupabaseAdmin();
  const clientUsername = String(options.username || '').trim();
  let guildId = ALBION_GUILD_ID;
  if (!guildId) {
    const searchData = await fetchJsonWithRetry(
      `${GAMEINFO_BASE}/search?q=${encodeURIComponent(GUILD_NAME)}`
    );
    const guild = (searchData.guilds || []).find(
      (g) => normalizeGuild(g.Name) === normalizeGuild(GUILD_NAME)
    );
    if (!guild) throw new Error(`Guilda "${GUILD_NAME}" não encontrada`);
    guildId = guild.Id;
  }

  const members = await fetchJsonWithRetry(`${GAMEINFO_BASE}/guilds/${guildId}/members`);
  const memberNames = new Set((members || []).map((m) => String(m.Name || '').toLowerCase()));

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, albion_character_name, role, is_active, albion_kill_fame, albion_pve_fame, albion_gathering_fame');

  if (error) throw error;

  let activated = 0;
  let deactivated = 0;
  let fameSynced = 0;
  let missionUpdates = 0;
  let matchedProfiles = 0;

  const memberByName = new Map(
    (members || []).map((m) => [String(m.Name || '').trim().toLowerCase(), m])
  );

  for (const profile of profiles || []) {
    const charName = String(
      profile.albion_character_name || profile.username || ''
    ).trim().toLowerCase();
    if (!charName) continue;

    const inGuild = memberNames.has(charName);

    if (inGuild && profile.is_active === false) {
      await supabase.from('profiles').update({ is_active: true }).eq('id', profile.id);
      activated += 1;
    } else if (!inGuild && profile.is_active !== false && profile.role !== 'admin') {
      await supabase.from('profiles').update({ is_active: false }).eq('id', profile.id);
      deactivated += 1;
    }

    const member = memberByName.get(charName);
    if (!member) continue;
    matchedProfiles += 1;

    const killNow = toNumber(member.KillFame);
    const pveNow = toNumber(member.LifetimeStatistics?.PvE?.Total);
    const gatherNow = toNumber(member.LifetimeStatistics?.Gathering?.All?.Total);

    const oldKill = toNumber(profile.albion_kill_fame);
    const oldPve = toNumber(profile.albion_pve_fame);
    const oldGather = toNumber(profile.albion_gathering_fame);

    const killDelta = oldKill > 0 ? Math.max(killNow - oldKill, 0) : 0;
    const pveDelta = oldPve > 0 ? Math.max(pveNow - oldPve, 0) : 0;
    const gatherDelta = oldGather > 0 ? Math.max(gatherNow - oldGather, 0) : 0;
    const needsBaseline =
      (oldKill === 0 && killNow > 0) ||
      (oldPve === 0 && pveNow > 0) ||
      (oldGather === 0 && gatherNow > 0);

    if (killDelta > 0 || pveDelta > 0 || gatherDelta > 0 || needsBaseline) {
      await supabase
        .from('profiles')
        .update({
          albion_kill_fame: Math.max(oldKill, killNow),
          albion_pve_fame: Math.max(oldPve, pveNow),
          albion_gathering_fame: Math.max(oldGather, gatherNow),
          albion_fame_synced_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
      fameSynced += 1;
    }

    // GameInfo entrega contadores absolutos e atrasados. Usamos esses valores
    // somente como baseline do perfil; progresso de missão precisa vir de
    // observações locais reais do Anaconda para não concluir missões sem jogo.
  }

  try {
    await supabase.rpc('celeste_finalize_completed_missions');
  } catch {
    /* noop */
  }
  const guildMetrics = await syncGuildMetricsSnapshot({
    supabase,
    guildId,
    guildName: GUILD_NAME,
    memberCount: memberNames.size,
  });
  const activePveMissions = await getActivePveMissionThresholds(supabase);
  const playerPveMissions = await getPlayerPveMissionThresholds(supabase, clientUsername);
  return {
    memberCount: memberNames.size,
    matchedProfiles,
    activated,
    deactivated,
    fameSynced,
    missionUpdates,
    guildMetrics,
    activePveMissions,
    playerPveMissions,
  };
}

export async function syncGameEvents() {
  const supabase = getSupabaseAdmin();
  const eventsUrl = `${GAMEINFO_BASE}/events?limit=20&offset=0`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetch(eventsUrl, { signal: controller.signal });
  } catch (error) {
    clearTimeout(timeout);
    return {
      inserted: 0,
      total: 0,
      warning:
        error?.name === 'AbortError'
          ? 'Eventos timeout'
          : `Eventos indisponível: ${error?.message || 'erro de rede'}`,
    };
  }
  clearTimeout(timeout);

  if (!res.ok) {
    return { inserted: 0, total: 0, warning: `Eventos upstream ${res.status}` };
  }

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

export async function migrateAlbionRenderAssetCache({ limit = 1000 } = {}) {
  const supabase = getSupabaseAdmin();
  const bucket = { name: ALBION_RENDER_BUCKET, ok: false, created: false, error: null };

  try {
    const { data: existing } = await supabase.storage.getBucket(ALBION_RENDER_BUCKET);
    if (existing) {
      bucket.ok = true;
    } else {
      const { error } = await supabase.storage.createBucket(ALBION_RENDER_BUCKET, {
        public: false,
        fileSizeLimit: 1024 * 1024,
        allowedMimeTypes: ['image/png'],
      });
      if (error) throw error;
      bucket.ok = true;
      bucket.created = true;
    }
  } catch (err) {
    bucket.error = err?.message || String(err);
  }

  let scanned = 0;
  let updated = 0;
  let failed = 0;
  const failures = [];
  const pageSize = 200;
  const maxRows = Math.max(1, Math.min(Number(limit) || 1000, 5000));

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data: rows, error } = await supabase
      .from('market_items')
      .select('item_id, image_url, active_skills, passive_skills')
      .range(offset, Math.min(offset + pageSize - 1, maxRows - 1));

    if (error) throw error;
    if (!rows?.length) break;

    for (const row of rows) {
      scanned += 1;
      const patch = {};

      const nextImageUrl = normalizeAlbionRenderUrl(row.image_url, 'item', row.item_id);
      if (nextImageUrl !== (row.image_url || null)) {
        patch.image_url = nextImageUrl;
      }

      const active = normalizeSkillIcons(row.active_skills);
      if (active.changed) patch.active_skills = active.value;

      const passive = normalizeSkillIcons(row.passive_skills);
      if (passive.changed) patch.passive_skills = passive.value;

      if (Object.keys(patch).length === 0) continue;

      const { error: updateError } = await supabase
        .from('market_items')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('item_id', row.item_id);

      if (updateError) {
        failed += 1;
        if (failures.length < 20) {
          failures.push({ itemId: row.item_id, error: updateError.message });
        }
        continue;
      }

      updated += 1;
    }

    if (rows.length < pageSize) break;
  }

  return { bucket, scanned, updated, failed, failures };
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
      return new URL(
        process.env.SUPABASE_URL ||
          process.env.VITE_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL
      ).host;
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
      username: String(meta.username || '').trim() || null,
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
    payload:
      obs.payload && typeof obs.payload === 'object'
        ? {
            ...obs.payload,
            client_id: clientId,
            username: obs.payload?.username || String(meta.username || '').trim() || null,
          }
        : {
            raw: String(obs.raw || ''),
            client_id: clientId,
            username: String(meta.username || '').trim() || null,
          },
  }));

  const { error } = await supabase.from('celeste_observations').insert(capped);
  if (error) throw error;

  const aggregate = await aggregateCelesteObservations(800);

  return { clientId, inserted: capped.length, aggregate };
}
