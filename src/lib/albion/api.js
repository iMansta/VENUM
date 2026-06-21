import { getRouteRisk, calculateExpectedProfit, getTravelTime, calculateEfficiency, calculateRiskAdjustedEfficiency } from './riskMap';
import { getSaturationLevel, calculateSaturationAdjustedPrice, getSaturationWarning } from './saturation';
import {
  getCachedMarketPricesByLocation,
  setCachedMarketPriceByLocation,
  setCachedMarketPricesByLocation,
  isCacheValid as isLocationCacheValid,
} from '@/lib/supabase/marketCacheByLocation';
import { getMarketSettings } from '@/lib/supabase/marketSettings';
import { MARKET_ITEMS } from '@/constants/marketItems';

// West datacenter do community data project (canônico desde 2024).
const ALBION_API_BASE = 'https://west.albion-online-data.com/api/v2/stats/prices';

/**
 * Sanitize de uma linha de preço do Albion Data Project.
 *
 * Retorna:
 *   - { ok: true,  data: { buy_price_min, buy_price_max, sell_price_min, sell_price_max, _hasData: true  } }
 *   - { ok: false, reason: 'all-zero' | 'malformed' }
 *
 * Linhas all-zero indicam "sem dados recentes" — não devem ir para o
 * cache nem entrar no cálculo.
 */
const sanitizePriceData = (row) => {
  if (!row || typeof row !== 'object' || !row.item_id) {
    return { ok: false, reason: 'malformed' };
  }

  const buyMin  = Number(row.buy_price_min  ?? 0);
  const buyMax  = Number(row.buy_price_max  ?? 0);
  const sellMin = Number(row.sell_price_min ?? 0);
  const sellMax = Number(row.sell_price_max ?? 0);

  const allZero = buyMin === 0 && buyMax === 0 && sellMin === 0 && sellMax === 0;

  if (allZero) {
    return { ok: false, reason: 'all-zero', location: row.location || row.city };
  }

  return {
    ok: true,
    data: {
      buy_price_min:  buyMin,
      buy_price_max:  buyMax,
      sell_price_min: sellMin,
      sell_price_max: sellMax,
      _hasData: true,
    },
  };
};

export const ARBITRAGE_LOCATIONS = Object.freeze([
  'Black Market',
  'Lymhurst',
  'Fort Sterling',
  'Bridgewatch',
  'Martlock',
  'Thetford',
]);

const BLACK_MARKET = 'Black Market';

const CACHE_TTL = 5 * 60 * 1000;
const priceCache = new Map();

let requestCount = 0;
let rateLimitErrorCount = 0;
let cacheHits = 0;
let cacheMisses = 0;

const MAX_CONCURRENT_REQUESTS = 2;
let activeRequests = 0;
const requestQueue = [];

const inFlightRequests = new Map();
let globalBlockUntil = 0;

const API_BATCH_SIZE = 10;
const INITIAL_VISIBLE_TIERS = new Set([4, 5]);

const getItemTier = (itemId) => {
  const tier = itemId?.match(/T(\d+)/)?.[1];
  return tier ? parseInt(tier, 10) : null;
};

const isInitialPriorityItem = (item) =>
  INITIAL_VISIBLE_TIERS.has(getItemTier(item.itemId));

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const generateCanonicalKey = (items, limit) => {
  const sortedItems = [...items].sort((a, b) => a.itemId.localeCompare(b.itemId));
  const itemsKey = sortedItems.map((i) => i.itemId).join(',');
  return `fetchTopOpportunities-${itemsKey}-${limit}`;
};

const getCachedPrice = (itemName) => {
  const cached = priceCache.get(itemName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    cacheHits++;
    return cached.data;
  }
  cacheMisses++;
  return null;
};

const setCachedPrice = (itemName, data) => {
  priceCache.set(itemName, { data, timestamp: Date.now() });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Valida se um item é equipamento aceito pelo Black Market.
 * Recursos (PLANK, ORE, FIBER, etc.) são excluídos.
 */
const isValidEquipment = (itemId) => {
  if (!itemId) return false;

  const excludedPatterns = [
    'PLANK', 'WOOD', 'ORE', 'METALBAR', 'FIBER',
    'ROCK', 'STONE',
  ];

  const upperItemId = itemId.toUpperCase();
  for (const pattern of excludedPatterns) {
    if (upperItemId.includes(pattern)) return false;
  }

  const validPatterns = [
    'BAG', 'HEAD_', 'ARMOR_', 'SHOES_', 'MAIN_',
    'OFF_', 'SHIELD', 'CAPE',
  ];

  return validPatterns.some((p) => upperItemId.includes(p));
};

const fetchWithRetry = async (url, retries = 3, initialDelay = 1000) => {
  if (Date.now() < globalBlockUntil) {
    await sleep(globalBlockUntil - Date.now());
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      requestCount++;
      const response = await fetch(url);

      if (response.status === 429) {
        rateLimitErrorCount++;
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : initialDelay * Math.pow(2, attempt);
        globalBlockUntil = Date.now() + delay;

        if (attempt < retries - 1) {
          await sleep(delay);
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      const delay = initialDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
};

const processQueue = async () => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) return;

  activeRequests++;
  const { resolve, reject, fn } = requestQueue.shift();
  try {
    const result = await fn();
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    activeRequests--;
    processQueue();
  }
};

const queueRequest = (fn) =>
  new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, fn });
    processQueue();
  });

export const fetchItemPrice = async (itemName, _locations = 1) => {
  const cached = getCachedPrice(itemName);
  if (cached) return cached;

  try {
    const response = await queueRequest(async () =>
      fetchWithRetry(`${ALBION_API_BASE}/${itemName}?locations=Black%20Market`)
    );
    const data = await response.json();
    const priceData = data[0] || null;
    if (priceData) setCachedPrice(itemName, priceData);
    return priceData;
  } catch (error) {
    console.error(`Error fetching price for ${itemName}:`, error);
    return null;
  }
};

/**
 * Busca preços para múltiplos itens em todas as locations de arbitragem.
 *
 * Saída normalizada:
 *   { item_id, locations: { [city]: {...} }, _source: 'cache' | 'mixed' }
 *
 * Cache lookup é por (item_id, location). Itens sem cache válido são
 * buscados no Albion API em batches de API_BATCH_SIZE.
 *
 * Itens all-zero são SILENCIOSAMENTE filtrados (apenas contados em
 * `allZeroCount`) — não poluem o console para o usuário final.
 */
export const fetchMultipleItemPrices = async (items, hasPremium = false, options = {}) => {
  const { onProgress, forceRefresh = false } = options;

  try {
    const startTime = Date.now();

    const validItems = items.filter((item) => isValidEquipment(item.itemId));

    if (validItems.length === 0) {
      onProgress?.({ loaded: 0, total: 0, phase: 'complete' });
      return [];
    }

    onProgress?.({ loaded: 0, total: validItems.length, phase: 'cache' });

    const itemIds = validItems.map((item) => item.itemId);
    const cachedByLocation = forceRefresh ? {} : await getCachedMarketPricesByLocation(itemIds);

    const cachedLocationsByItem = new Map();
    for (const itemId of itemIds) {
      const rows = cachedByLocation[itemId] || [];
      const validMap = new Map();
      rows.forEach((row) => {
        const expiresAt = row.expiresAt ?? row.expires_at;
        const location = row.location ?? row.city;
        const priceData = row.priceData ?? row.price_data;
        if (!forceRefresh && location && isLocationCacheValid(expiresAt)) {
          validMap.set(location, priceData);
        }
      });
      cachedLocationsByItem.set(itemId, validMap);
    }

    const uncachedItems = [];
    const itemsFullyCached = [];

    validItems.forEach((item) => {
      const cachedMap = cachedLocationsByItem.get(item.itemId) || new Map();
      const missingLocations = ARBITRAGE_LOCATIONS.filter((loc) => !cachedMap.has(loc));
      if (missingLocations.length === 0) {
        itemsFullyCached.push({ item, cachedMap });
      } else {
        uncachedItems.push(item);
      }
    });

    onProgress?.({
      loaded: itemsFullyCached.length,
      total: validItems.length,
      phase: uncachedItems.length > 0 ? 'fetch' : 'complete',
    });

    const fetchedByItem = new Map();

    if (uncachedItems.length > 0) {
      const batches = chunkArray(uncachedItems, API_BATCH_SIZE);
      const locationsParam = ARBITRAGE_LOCATIONS.map(encodeURIComponent).join(',');
      let loadedCount = itemsFullyCached.length;

      for (let i = 0; i < batches.length; i++) {
        const itemIdsBatch = batches[i].map((item) => item.itemId).join(',');

        try {
          const response = await queueRequest(async () =>
            fetchWithRetry(`${ALBION_API_BASE}/${itemIdsBatch}?locations=${locationsParam}`)
          );
          const data = await response.json();

          const upserts = [];
          let allZeroCount = 0;
          for (const row of data) {
            if (!row || !isValidEquipment(row.item_id)) continue;
            const loc = row.location || row.city;
            if (!loc || !ARBITRAGE_LOCATIONS.includes(loc)) continue;

            // Silencioso: all-zero é esperado quando ninguém visitou a cidade.
            const sanitized = sanitizePriceData(row);
            if (!sanitized.ok) {
              allZeroCount++;
              continue;
            }

            if (!fetchedByItem.has(row.item_id)) fetchedByItem.set(row.item_id, new Map());
            fetchedByItem.get(row.item_id).set(loc, sanitized.data);
            upserts.push({ itemId: row.item_id, location: loc, priceData: sanitized.data });
          }

          if (upserts.length > 0) {
            await setCachedMarketPricesByLocation(upserts);
          }
        } catch (error) {
          console.error(`[FETCH] Error fetching batch ${i + 1}:`, error);
        }

        loadedCount += batches[i].length;
        onProgress?.({
          loaded: Math.min(loadedCount, validItems.length),
          total: validItems.length,
          phase: i === batches.length - 1 ? 'complete' : 'fetch',
        });

        await sleep(0);
        if (i < batches.length - 1) {
          await sleep(1000 + Math.random() * 500);
        }
      }
    }

    const allResults = [];
    for (const item of validItems) {
      const cachedMap = cachedLocationsByItem.get(item.itemId) || new Map();
      const fetchedMap = fetchedByItem.get(item.itemId) || new Map();

      const locations = {};
      let fromCacheCount = 0;
      let fromApiCount = 0;

      for (const loc of ARBITRAGE_LOCATIONS) {
        if (fetchedMap.has(loc)) {
          locations[loc] = fetchedMap.get(loc);
          fromApiCount++;
        } else if (cachedMap.has(loc)) {
          locations[loc] = cachedMap.get(loc);
          fromCacheCount++;
        }
      }

      if (Object.keys(locations).length === 0) continue;

      allResults.push({
        item_id: item.itemId,
        locations,
        _source: fromApiCount > 0 ? 'mixed' : 'cache',
        _stats: { fromCacheCount, fromApiCount },
      });
    }

    return allResults;
  } catch (error) {
    console.error('[FETCH] Error fetching multiple item prices:', error);
    return [];
  }
};

/**
 * Calcula oportunidade de arbitragem de um item.
 *
 * Compara a cidade mais barata (menor `buy_price_min`) contra o Black
 * Market (maior `buy_price_max` = instant sell).
 *
 * Retorna `null` silenciosamente quando:
 *   - Item não é equipamento válido
 *   - Sem dados no Black Market
 *   - Sem nenhuma cidade com preço de compra válido
 */
export const calculateArbitrage = (priceData, targetCity = BLACK_MARKET, hasPremium = false) => {
  if (!priceData) return null;

  const itemId = priceData.item_id;
  if (!isValidEquipment(itemId)) return null;

  const locations = priceData.locations || priceData.data;
  if (!locations || typeof locations !== 'object') return null;

  const bmEntry = locations[BLACK_MARKET];
  if (!bmEntry) return null;

  const bmSellPrice = bmEntry.buy_price_max > 0
    ? bmEntry.buy_price_max
    : (bmEntry.sell_price_min || 0);

  if (bmSellPrice <= 0) return null;

  let bestBuy = null;
  for (const [city, entry] of Object.entries(locations)) {
    if (city === targetCity) continue;
    if (!entry || typeof entry !== 'object') continue;

    const buyPrice = entry.buy_price_min;
    if (!Number.isFinite(buyPrice) || buyPrice <= 0) continue;

    if (!bestBuy || buyPrice < bestBuy.price) {
      bestBuy = { city, price: buyPrice };
    }
  }

  if (!bestBuy) return null;

  // BM fees: 2.5% setup + 3.5% (sem premium) ou 2.5% (com premium)
  const setupFee = bmSellPrice * 0.025;
  const transactionFeeRate = hasPremium ? 0.025 : 0.035;
  const transactionFee = bmSellPrice * transactionFeeRate;
  const totalFees = setupFee + transactionFee;

  const grossProfit = bmSellPrice - bestBuy.price;
  const netProfit = grossProfit - totalFees;
  const margin = bestBuy.price > 0 ? (netProfit / bestBuy.price) * 100 : 0;

  const risk = getRouteRisk(bestBuy.city, targetCity);
  const travelTime = getTravelTime(bestBuy.city, targetCity);
  const expectedProfit = calculateExpectedProfit(netProfit, risk.value);
  const efficiency = calculateEfficiency(netProfit, travelTime);
  const riskAdjustedEfficiency = calculateRiskAdjustedEfficiency(netProfit, travelTime, risk.value);

  const saturationLevel = getSaturationLevel(itemId);
  const saturationAdjustedPrice = calculateSaturationAdjustedPrice(itemId, bmSellPrice);
  const saturationAdjustedProfit = saturationAdjustedPrice - bestBuy.price - totalFees;

  return {
    itemId,
    itemName: itemId,
    buyCity: bestBuy.city,
    buyPrice: bestBuy.price,
    sellCity: targetCity,
    bmPrice: bmSellPrice,
    grossProfit,
    setupFee,
    transactionFee,
    totalFees,
    netProfit,
    margin,
    risk,
    travelTime,
    expectedProfit,
    efficiency,
    riskAdjustedEfficiency,
    saturation: saturationLevel,
    saturationAdjustedProfit,
    saturationWarning: getSaturationWarning(itemId),
    hasPremium,
    lowestCity: bestBuy.city,
    lowestPrice: bestBuy.price,
  };
};

/**
 * Busca as top oportunidades para uma lista de itens.
 * Recebe a lista mestra `MARKET_ITEMS` (~400+ itens) e devolve o top N
 * ranqueado por netProfit.
 */
export const fetchTopOpportunities = async (
  items,
  limit = 10,
  hasPremium = false,
  options = {}
) => {
  let premium = hasPremium;
  let fetchOptions = options;
  if (typeof hasPremium === 'object') {
    premium = false;
    fetchOptions = hasPremium;
  }

  const { includeAllTiers = false, onProgress, forceRefresh = false } = fetchOptions || {};
  const selectedItems = includeAllTiers ? items : items.filter(isInitialPriorityItem);

  if (selectedItems.length === 0) {
    onProgress?.({ loaded: 0, total: 0, phase: 'complete' });
    return [];
  }

  const requestKey = generateCanonicalKey(selectedItems, limit);
  if (inFlightRequests.has(requestKey)) return inFlightRequests.get(requestKey);

  const requestPromise = (async () => {
    try {
      const settings = await getMarketSettings();
      const priceData = await fetchMultipleItemPrices(selectedItems, premium, {
        onProgress,
        forceRefresh,
      });

      if (priceData.length === 0) return [];

      const itemMetadataById = new Map(
        selectedItems.map((item) => [item.itemId, item])
      );

      const DEBUG_DISABLE_THRESHOLDS = true;
      const effectiveMinProfit = DEBUG_DISABLE_THRESHOLDS ? 0 : settings.minProfit;
      const effectiveMinMarginPct = DEBUG_DISABLE_THRESHOLDS ? 0 : settings.minMarginPct * 100;

      return priceData
        .map((data) => {
          const itemMetadata = itemMetadataById.get(data.item_id) || {
            enchantment: 0,
            quantity: 1,
          };
          const arbitrage = calculateArbitrage(data, BLACK_MARKET, premium);
          if (!arbitrage) return null;
          return {
            ...arbitrage,
            enchantment: itemMetadata.enchantment,
            quantity: itemMetadata.quantity,
          };
        })
        .filter((opp) => {
          if (!opp) return false;
          if (opp.netProfit < effectiveMinProfit) return false;
          if (opp.margin < effectiveMinMarginPct) return false;
          return true;
        })
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, limit);
    } catch (error) {
      console.error('[FETCH] Error fetching top opportunities:', error);
      return [];
    } finally {
      inFlightRequests.delete(requestKey);
    }
  })();

  inFlightRequests.set(requestKey, requestPromise);
  return requestPromise;
};

/**
 * Lista mestra de itens negociáveis no Black Market.
 * Gerada em `src/constants/marketItems.js` (~400+ itens: T4-T8 × enchants 0-3).
 *
 * Mantido o nome `COMMON_ITEMS` para compatibilidade com imports legados.
 */
export const COMMON_ITEMS = MARKET_ITEMS;

/** Tamanho efetivo da lista para diagnostics/logs. */
export const MARKET_ITEM_COUNT = MARKET_ITEMS.length;