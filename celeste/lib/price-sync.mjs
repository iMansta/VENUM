import { createClient } from '@supabase/supabase-js';
import { ALBION_DATA_BASE, ROYAL_CITIES, SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.mjs';

const BM_CITY = 'Caerleon';
const BATCH = 40;
const LOCATIONS = [...ROYAL_CITIES, BM_CITY].join(',');

const FALLBACK_ITEMS = [
  'T4_MAIN_SWORD', 'T5_MAIN_SWORD', 'T6_MAIN_SWORD', 'T7_MAIN_SWORD', 'T8_MAIN_SWORD',
  'T4_BAG', 'T5_BAG', 'T6_BAG', 'T7_BAG', 'T8_BAG',
  'T4_CAPE', 'T5_CAPE', 'T6_CAPE', 'T7_CAPE', 'T8_CAPE',
  'T4_HEAD_PLATE', 'T5_HEAD_PLATE', 'T6_HEAD_PLATE', 'T7_HEAD_PLATE', 'T8_HEAD_PLATE',
];

async function getCatalogIds(supabase) {
  try {
    const { data, error } = await supabase.rpc('get_arbitrage_catalog_item_ids', {
      p_min_tier: 4,
      p_max_tier: 8,
      p_limit: 500,
    });
    if (!error && data?.length) return data.map((r) => r.item_id || r);
  } catch { /* fallback */ }

  try {
    const { data: rows } = await supabase
      .from('market_items')
      .select('item_id')
      .gte('tier', 4)
      .lte('tier', 8)
      .limit(500);
    if (rows?.length) return rows.map((r) => r.item_id);
  } catch { /* fallback */ }

  return FALLBACK_ITEMS;
}

async function fetchPrices(itemIds) {
  const url = `${ALBION_DATA_BASE}/api/v2/stats/prices/${itemIds.join(',')}.json?locations=${LOCATIONS}&qualities=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Albion Data API ${res.status}`);
  return res.json();
}

export async function syncMarketPrices() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const itemIds = await getCatalogIds(supabase);

  let totalRows = 0;
  for (let i = 0; i < itemIds.length; i += BATCH) {
    const batch = itemIds.slice(i, i + BATCH);
    try {
      const prices = await fetchPrices(batch);
      for (const row of prices) {
        if (!row.item_id || !row.city) continue;
        await supabase.rpc('set_cached_market_price_by_location', {
          p_item_id: row.item_id,
          p_location: row.city,
          p_price_data: {
            buy_price_min: row.buy_price_min,
            buy_price_max: row.buy_price_max,
            sell_price_min: row.sell_price_min,
            sell_price_max: row.sell_price_max,
          },
        });
        totalRows++;
      }
    } catch (err) {
      console.warn(`[CELESTE] preços lote ${i / BATCH + 1}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[CELESTE] ${totalRows} preços sincronizados`);
  return { rows: totalRows };
}
