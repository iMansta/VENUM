import {
  getCachedMarketPricesByLocation,
  setCachedMarketPricesByLocation,
  isCacheValid,
} from '@/lib/supabase/marketCacheByLocation';
import { getMarketSettings } from '@/lib/supabase/marketSettings';
import {
  getRouteRisk,
  calculateExpectedProfit,
  getTravelTime,
} from '@/lib/albion/riskMap';

const ALBION_API_BASE = 'https://www.albion-online-data.com/api/v2/stats/prices';
const ROYAL_CITIES = ['Martlock', 'Thetford', 'Fort Sterling', 'Lymhurst', 'Bridgewatch'];
const BM_CITY = 'Caerleon';
const ALL_LOCATIONS = [...ROYAL_CITIES, BM_CITY];
const BATCH_SIZE = 40;
const BM_SETUP_TAX = 0.065;
const DEFAULT_QUALITY = 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseItemId = (itemId) => {
  const [base, enchStr] = String(itemId).split('@');
  const tierMatch = base.match(/^T(\d+)_/);
  return {
    base,
    tier: tierMatch ? Number(tierMatch[1]) : 0,
    enchantment: enchStr ? Number(enchStr) : 0,
  };
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

/**
 * Busca preços na API Albion Data Project.
 * @param {string[]} itemIds
 * @returns {Promise<Array>}
 */
const fetchPricesFromApi = async (itemIds) => {
  const locations = ALL_LOCATIONS.join(',');
  const url = `${ALBION_API_BASE}/${itemIds.join(',')}.json?locations=${locations}&qualities=${DEFAULT_QUALITY}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    if (text.includes('Bad IP') || response.status === 403) {
      throw new Error('API Albion bloqueou este IP (Bad IP). Tente novamente mais tarde.');
    }
    throw new Error(`API Albion retornou ${response.status}`);
  }
  return response.json();
};

/**
 * Agrupa linhas da API/cache por item_id → { city → priceData }.
 */
const groupByItem = (rows) => {
  const map = {};
  (rows || []).forEach((row) => {
    const itemId = row.item_id ?? row.itemId;
    const city = row.city ?? row.location;
    if (!itemId || !city) return;

    const priceData = row.price_data ?? {
      buy_price_min: row.buy_price_min,
      buy_price_max: row.buy_price_max,
      sell_price_min: row.sell_price_min,
      sell_price_max: row.sell_price_max,
    };

    if (!map[itemId]) map[itemId] = {};
    map[itemId][city] = priceData;
  });
  return map;
};

/**
 * Converte cache Supabase (array por item) em mapa city → priceData.
 */
const cacheToCityMap = (cachedRows) => {
  const map = {};
  (cachedRows || []).forEach((row) => {
    if (row.location && row.priceData) {
      map[row.location] = row.priceData;
    }
  });
  return map;
};

/**
 * Calcula oportunidade de arbitragem para um item.
 */
const computeOpportunity = (itemId, cityPrices, settings) => {
  let lowestCity = null;
  let lowestPrice = Infinity;

  for (const city of ROYAL_CITIES) {
    const pd = cityPrices[city];
    if (!pd) continue;
    const buy = Number(pd.sell_price_min) || 0;
    if (buy > 0 && buy < lowestPrice) {
      lowestPrice = buy;
      lowestCity = city;
    }
  }

  const bmData = cityPrices[BM_CITY];
  const bmPrice = Number(bmData?.buy_price_max) || 0;

  if (!lowestCity || lowestPrice === Infinity || bmPrice <= 0) return null;

  const netRevenue = bmPrice * (1 - BM_SETUP_TAX);
  const netProfit = netRevenue - lowestPrice;
  const margin = lowestPrice > 0 ? (netProfit / lowestPrice) * 100 : 0;

  const minProfit = settings.minProfit ?? 10000;
  const minMarginPct = (settings.minMarginPct ?? 0.1) * 100;

  if (netProfit < minProfit || margin < minMarginPct) return null;

  const risk = getRouteRisk(lowestCity, BM_CITY);
  const expectedProfit = calculateExpectedProfit(netProfit, risk.value);
  const travelTime = getTravelTime(lowestCity, BM_CITY);
  const { enchantment } = parseItemId(itemId);

  return {
    itemId,
    enchantment,
    lowestCity,
    lowestPrice,
    sellCity: 'Black Market',
    bmPrice,
    netProfit,
    expectedProfit,
    margin,
    risk,
    travelTime,
    quantity: Number(bmData?.buy_price_max_count) || 1,
  };
};

/**
 * Busca top oportunidades de arbitragem Royal → Black Market.
 *
 * @param {string[]} itemIds
 * @param {number} limit
 * @param {boolean} _legacyPremium
 * @param {object} options
 */
export const fetchTopOpportunities = async (
  itemIds,
  limit = 50,
  _legacyPremium = false,
  options = {}
) => {
  const {
    includeAllTiers = true,
    onProgress = null,
    forceRefresh = false,
  } = options;

  let ids = [...(itemIds || [])];
  if (!includeAllTiers) {
    ids = ids.filter((id) => {
      const { tier } = parseItemId(id);
      return tier >= 6 && tier <= 8;
    });
  }

  const settings = await getMarketSettings();
  const batches = chunk(ids, BATCH_SIZE);
  const allCityPrices = {};
  let loaded = 0;

  onProgress?.({ loaded: 0, total: ids.length, phase: 'cache' });

  for (const batch of batches) {
    let batchPrices = {};

    if (!forceRefresh) {
      const cached = await getCachedMarketPricesByLocation(batch);
      for (const itemId of batch) {
        const rows = cached[itemId];
        if (rows?.length && rows.every((r) => isCacheValid(r.expiresAt))) {
          batchPrices[itemId] = cacheToCityMap(rows);
        }
      }
    }

    const missing = batch.filter((id) => !batchPrices[id]);
    if (missing.length > 0) {
      onProgress?.({ loaded, total: ids.length, phase: 'api' });
      try {
        const apiRows = await fetchPricesFromApi(missing);
        const grouped = groupByItem(apiRows);

        const cacheEntries = [];
        for (const itemId of missing) {
          const cityMap = grouped[itemId] || {};
          batchPrices[itemId] = cityMap;
          for (const [location, priceData] of Object.entries(cityMap)) {
            cacheEntries.push({ itemId, location, priceData });
          }
        }
        if (cacheEntries.length > 0) {
          await setCachedMarketPricesByLocation(cacheEntries);
        }
      } catch (err) {
        console.warn('[ALBION API] Batch failed, skipping:', err.message);
      }
      await sleep(150);
    }

    Object.assign(allCityPrices, batchPrices);
    loaded += batch.length;
    onProgress?.({ loaded, total: ids.length, phase: 'api' });
  }

  onProgress?.({ loaded: ids.length, total: ids.length, phase: 'compute' });

  const opportunities = [];
  for (const itemId of ids) {
    const cityPrices = allCityPrices[itemId];
    if (!cityPrices) continue;
    const opp = computeOpportunity(itemId, cityPrices, settings);
    if (opp) opportunities.push(opp);
  }

  opportunities.sort((a, b) => b.netProfit - a.netProfit);
  onProgress?.({ loaded: ids.length, total: ids.length, phase: 'complete' });

  return opportunities.slice(0, limit);
};

export { COMMON_ITEMS } from '@/constants/marketItems';
