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

// ============================================================================
// Cache TTL & Freshness thresholds
// ============================================================================
// Janela de "dados frescos": até 15 minutos desde o cached_at.
// Janela de "dados utilizáveis": até 24 horas (após isso, descartar).
const CACHE_FRESH_MS = 15 * 60 * 1000;       // 15 min
const CACHE_HARD_LIMIT_MS = 24 * 60 * 60 * 1000; // 24h

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

/**
 * Normaliza `minMarginPct` (do `market_settings`) para **percentual (0–100)**.
 *
 * O banco deveria gravar como fração (0.10 = 10%), mas dados legados podem
 * estar como percentual direto (10 = 10%). Esta função:
 *   - Trata NaN/inválido como 0
 *   - Auto-detecta a unidade: valor > 1 já está em percentual
 *   - Faz clamp em [0, 100] para evitar absurdos (ex.: 1000%)
 *   - Loga warning quando detecta valor suspeito (> 1) para facilitar cleanup
 *
 * @param {number} value - valor bruto de `market_settings.min_margin_pct`
 * @returns {number} percentual em escala 0–100
 */
const normalizeMinMarginPctToPercent = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    console.warn(`[MARKET] minMarginPct negativo (${value}), clamped para 0.`);
    return 0;
  }
  // Auto-detect: se > 1, assume que já está em percentual (10 = 10%).
  // Caso contrário, trata como fração (0.10 = 10%).
  if (value > 1) {
    console.warn(
      `[MARKET] minMarginPct=${value} detectado como percentual direto (>1). ` +
        `Esperado fração (0–1). Considere normalizar market_settings.min_margin_pct.`
    );
    return Math.max(0, Math.min(100, value));
  }
  return Math.max(0, Math.min(100, value * 100));
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
 * Política de cache:
 *   - Item está no cache e `cached_at` < 15 min  → use o cache, SEM fetch externo.
 *   - Item está no cache mas `cached_at` entre 15 min e 24 h → use o cache para
 *     preencher locations já conhecidas; só busca na API as locations faltantes.
 *   - Item está no cache com `cached_at` > 24 h ou ausente → ignora a entrada,
 *     busca na API como fresh.
 *   - Itens all-zero são SILENCIOSAMENTE filtrados (sem poluir o console).
 *
 * Saída normalizada:
 *   { item_id, locations: { [city]: {...} }, _source: 'cache' | 'mixed' | 'api' }
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

    // Item-id -> Map(location -> priceData) para o que está FRESCO (< 15 min).
    const freshLocationsByItem = new Map();
    let skippedStaleCount = 0;

    for (const itemId of itemIds) {
      const rows = cachedByLocation[itemId] || [];
      const validMap = new Map();

      rows.forEach((row) => {
        const expiresAt = row.expiresAt ?? row.expires_at;
        const cachedAt  = row.cachedAt  ?? row.cached_at;
        const location  = row.location ?? row.city;
        const priceData = row.priceData ?? row.price_data;

        if (!location || !priceData) return;

        // Sem cached_at válido → ignora silenciosamente
        const ts = cachedAt ? new Date(cachedAt).getTime() : null;
        if (!ts || Number.isNaN(ts)) return;

        const ageMs = Date.now() - ts;
        // Mais de 24h → descartar
        if (ageMs > CACHE_HARD_LIMIT_MS) {
          skippedStaleCount++;
          return;
        }

        // TTL de 15 min: só conta como "fresh" (e pula fetch externo) se ainda
        // estiver dentro da janela de freshness.
        const isFresh = ageMs < CACHE_FRESH_MS;
        if (forceRefresh || !isLocationCacheValid(expiresAt)) return;

        validMap.set(location, priceData);
        // Marca freshness no Map para diagnóstico
        validMap.__fresh = isFresh;
      });

      freshLocationsByItem.set(itemId, validMap);
    }

    if (skippedStaleCount > 0) {
      console.log(
        `[CACHE] Descartados ${skippedStaleCount} registros com mais de 24h.`
      );
    }

    const uncachedItems = [];
    const itemsFullyCached = [];

    validItems.forEach((item) => {
      const cachedMap = freshLocationsByItem.get(item.itemId) || new Map();
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

    // Combina cache fresco + API fresca. Itens sem nenhuma location válida
    // são pulados (ficam fora do resultado).
    const allResults = [];
    for (const item of validItems) {
      const cachedMap = freshLocationsByItem.get(item.itemId) || new Map();
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
 * Mapeamento de preços (Tarefa 7.3):
 *   - buyPrice (custo de aquisição) usa `sell_price_min` — o menor
 *     preço pelo qual um vendedor na cidade está disposto a vender.
 *     Se for 0 ou inválido, ignoramos essa cidade.
 *   - sellPrice (lucro no Black Market) usa `buy_price_max` — a maior
 *     ordem de compra instantânea que o BM está disposto a pagar.
 *     Se for 0 ou inválido, descartamos o item inteiro.
 *
 * Retorna `null` silenciosamente quando:
 *   - Item não é equipamento válido
 *   - Sem dados no Black Market (ou sell_price <= 0)
 *   - Sem nenhuma cidade com preço de venda válido
 */
export const calculateArbitrage = (priceData, targetCity = BLACK_MARKET, hasPremium = false) => {
  if (!priceData) return null;

  const itemId = priceData.item_id;
  if (!isValidEquipment(itemId)) return null;

  const locations = priceData.locations || priceData.data;
  if (!locations || typeof locations !== 'object') return null;

  const bmEntry = locations[BLACK_MARKET];
  if (!bmEntry) return null;

  // sellPrice do BM = buy_price_max (maior ordem de compra no Black Market)
  // Fallback para sell_price_min apenas se buy_price_max for 0/null.
  const bmSellPrice = Number(bmEntry.buy_price_max ?? 0) > 0
    ? Number(bmEntry.buy_price_max)
    : Number(bmEntry.sell_price_min ?? 0);

  if (!Number.isFinite(bmSellPrice) || bmSellPrice <= 0) return null;

  // buyPrice = sell_price_min (menor preço de venda) em cada cidade
  // (excluindo a própria cidade-alvo).
  let bestBuy = null;
  for (const [city, entry] of Object.entries(locations)) {
    if (city === targetCity) continue;
    if (!entry || typeof entry !== 'object') continue;

    // Ignora entradas sem sell_price_min válido (0, null ou NaN)
    const sellMin = Number(entry.sell_price_min ?? 0);
    if (!Number.isFinite(sellMin) || sellMin <= 0) continue;

    if (!bestBuy || sellMin < bestBuy.price) {
      bestBuy = { city, price: sellMin };
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
  // margin é calculado como PERCENTUAL DIRETO (ex.: 12.5 = 12.5%).
  // O filtro em fetchTopOpportunities usa minMarginPct (do banco, fração 0..1)
  // normalizado para a mesma escala 0..100 via normalizeMinMarginPctToPercent.
  const margin = bestBuy.price > 0 ? (netProfit / bestBuy.price) * 100 : 0;

  // [DIAG] Log estruturado por item para validação de unidades.
  // Mostra os valores brutos que entram no filtro (buy/sell, fees, netProfit, margin em %)
  // para que se possa auditar se margin está em 0..100 e se a comparação com o threshold
  // normalizado está na mesma escala.
  console.log('[ARB]', itemId, {
    buyCity: bestBuy.city,
    buyPrice: bestBuy.price,
    bmSellPrice,
    totalFees,
    netProfit,
    marginPct: margin,
  });

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
 *
 * @param {object} options
 * @param {number} options.cacheTtlMinutes  Opcional (default 15). Se o
 *   cache do Supabase tiver `cached_at` mais recente que isso, NÃO faz
 *   fetch na API externa para esse item.
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

  const { includeAllTiers = false, onProgress, forceRefresh = false, cacheTtlMinutes } = fetchOptions || {};
  const selectedItems = includeAllTiers ? items : items.filter(isInitialPriorityItem);

  if (selectedItems.length === 0) {
    onProgress?.({ loaded: 0, total: 0, phase: 'complete' });
    return [];
  }

  // Override do TTL (em minutos) — útil para testes
  if (cacheTtlMinutes && Number.isFinite(cacheTtlMinutes)) {
    // Não podemos sobrescrever a const CACHE_FRESH_MS diretamente aqui
    // porque é usada dentro de fetchMultipleItemPrices via closure.
    // Em vez disso, encaminhamos como flag `cacheFreshMs`.
    fetchOptions = { ...fetchOptions, cacheFreshMs: cacheTtlMinutes * 60 * 1000 };
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

      const effectiveMinProfit = settings.minProfit;
      // Normaliza minMarginPct (banco: fração 0–1 OU percentual direto) para %
      // e compara diretamente com opp.margin (que está em percentual).
      const effectiveMinMarginPct = normalizeMinMarginPctToPercent(settings.minMarginPct);

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

/** Expor as constantes de TTL para diagnóstico. */
export const CACHE_THRESHOLDS = {
  freshMs: CACHE_FRESH_MS,
  hardLimitMs: CACHE_HARD_LIMIT_MS,
};