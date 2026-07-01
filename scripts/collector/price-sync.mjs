import { createClient } from '@supabase/supabase-js';
import {
  ALBION_DATA_BASE,
  ROYAL_CITIES,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} from './config.mjs';

const BM_CITY = 'Caerleon';
const BATCH = 40;
const LOCATIONS = [...ROYAL_CITIES, BM_CITY].join(',');

async function getCatalogIds(supabase) {
  const { data, error } = await supabase.rpc('get_arbitrage_catalog_item_ids', {
    p_min_tier: 4,
    p_max_tier: 8,
    p_limit: 500,
  });
  if (!error && data?.length) {
    return data.map((r) => r.item_id || r);
  }

  const { data: rows } = await supabase
    .from('market_items')
    .select('item_id')
    .gte('tier', 4)
    .lte('tier', 8)
    .limit(500);

  return (rows || []).map((r) => r.item_id);
}

async function fetchPrices(itemIds) {
  const url = `${ALBION_DATA_BASE}/api/v2/stats/prices/${itemIds.join(',')}.json?locations=${LOCATIONS}&qualities=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Albion Data API ${res.status}`);
  return res.json();
}

export async function syncMarketPrices() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase service role não configurada');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const itemIds = await getCatalogIds(supabase);

  if (!itemIds.length) {
    console.warn('[PRICE SYNC] Catálogo vazio — rode npm run catalog:seed');
    return { batches: 0, rows: 0 };
  }

  let totalRows = 0;
  for (let i = 0; i < itemIds.length; i += BATCH) {
    const batch = itemIds.slice(i, i + BATCH);
    try {
      const prices = await fetchPrices(batch);
      for (const row of prices) {
        if (!row.item_id || !row.city) continue;
        const priceData = {
          buy_price_min: row.buy_price_min,
          buy_price_max: row.buy_price_max,
          sell_price_min: row.sell_price_min,
          sell_price_max: row.sell_price_max,
        };
        await supabase.rpc('set_cached_market_price_by_location', {
          p_item_id: row.item_id,
          p_location: row.city,
          p_price_data: priceData,
        });
        totalRows++;
      }
    } catch (err) {
      console.warn(`[PRICE SYNC] Batch ${i / BATCH + 1} falhou:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[PRICE SYNC] ${totalRows} preços atualizados (${itemIds.length} itens)`);
  return { batches: Math.ceil(itemIds.length / BATCH), rows: totalRows };
}
