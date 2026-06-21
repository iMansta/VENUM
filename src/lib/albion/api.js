import { getRouteRisk, calculateExpectedProfit, getTravelTime, calculateEfficiency, calculateRiskAdjustedEfficiency } from './riskMap';
import { getSaturationLevel, calculateSaturationAdjustedPrice, getSaturationWarning } from './saturation';
import {
  getCachedMarketPricesByLocation,
  setCachedMarketPriceByLocation,
  setCachedMarketPricesByLocation,
  isCacheValid as isLocationCacheValid,
} from '@/lib/supabase/marketCacheByLocation';
import { getMarketSettings } from '@/lib/supabase/marketSettings';

// Use the West datacenter endpoint. The legacy `www` host still works
// but `west` has been the canonical host for the community data project
// since 2024 and gives lower latency for South American / European users.
const ALBION_API_BASE = 'https://west.albion-online-data.com/api/v2/stats/prices';

/**
 * Sanitize a single price row coming from the Albion API.
 *
 * Returns either:
 *   - { ok: true,  data: { buy_price_min, buy_price_max, sell_price_min, sell_price_max, _hasData: true  } }
 *   - { ok: false, reason: 'all-zero' | 'malformed', _hasData: false }
 *
 * Items where EVERY field is 0 are flagged as "Sem dados recentes" — the
 * community data project simply has no recent sale/buy order for that
 * (item, location) pair. The caller should skip caching those.
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

// Locations we care about for arbitrage. The Black Market is where we sell,
// the others are where we might buy cheaper.
export const ARBITRAGE_LOCATIONS = Object.freeze([
  'Black Market',
  'Lymhurst',
  'Fort Sterling',
  'Bridgewatch',
  'Martlock',
  'Thetford',
]);

const BLACK_MARKET = 'Black Market';

// Cache with TTL (5 minutes to reduce stale in-memory results)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const priceCache = new Map();

// Request statistics
let requestCount = 0;
let rateLimitErrorCount = 0;
let cacheHits = 0;
let cacheMisses = 0;

// Concurrency limiter (max 2 simultaneous requests - reduced to avoid rate limiting)
const MAX_CONCURRENT_REQUESTS = 2;
let activeRequests = 0;
const requestQueue = [];

// Single-flight cache for in-flight requests
const inFlightRequests = new Map();

// Global cooldown for rate limiting
let globalBlockUntil = 0;

const API_BATCH_SIZE = 10;
const INITIAL_VISIBLE_TIERS = new Set([4, 5]);

const getItemTier = (itemId) => {
  const tier = itemId?.match(/T(\d+)/)?.[1];
  return tier ? parseInt(tier, 10) : null;
};

const isInitialPriorityItem = (item) => INITIAL_VISIBLE_TIERS.has(getItemTier(item.itemId));

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Generate canonical key for cache and single-flight
 * Ensures consistent keys regardless of parameter order
 */
const generateCanonicalKey = (items, limit) => {
  // Sort items by itemId to ensure consistent key
  const sortedItems = [...items].sort((a, b) => a.itemId.localeCompare(b.itemId));
  const itemsKey = sortedItems.map(i => i.itemId).join(',');
  return `fetchTopOpportunities-${itemsKey}-${limit}`;
};

/**
 * Get cached price data if available and not expired
 */
const getCachedPrice = (itemName) => {
  const cached = priceCache.get(itemName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    cacheHits++;
    console.log(`[CACHE HIT] ${itemName} (hits: ${cacheHits}, misses: ${cacheMisses})`);
    return cached.data;
  }
  cacheMisses++;
  console.log(`[CACHE MISS] ${itemName} (hits: ${cacheHits}, misses: ${cacheMisses})`);
  return null;
};

/**
 * Set cached price data
 */
const setCachedPrice = (itemName, data) => {
  priceCache.set(itemName, {
    data,
    timestamp: Date.now(),
  });
};

/**
 * Sleep function for retry delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate if an item is equipment (can be sold in Black Market)
 * Black Market only accepts: Weapons, Armor, Bags, Shoes, Head, Capes
 * Excludes resource-only item patterns while allowing cloth/leather equipment
 * @param {string} itemId - Item ID to validate
 * @returns {boolean} True if item is valid equipment
 */
const isValidEquipment = (itemId) => {
  if (!itemId) return false;
  
  const excludedPatterns = [
    'PLANK', 'WOOD', 'ORE', 'METALBAR', 'FIBER', 
    'ROCK', 'STONE'
  ];
  
  const upperItemId = itemId.toUpperCase();
  
  // Check if item contains any excluded pattern
  for (const pattern of excludedPatterns) {
    if (upperItemId.includes(pattern)) {
      console.log(`[FILTER] Excluded item: ${itemId} (contains ${pattern})`);
      return false;
    }
  }
  
  // Valid equipment patterns accepted by the Black Market
  const validPatterns = [
    'BAG', 'HEAD_', 'ARMOR_', 'SHOES_', 'MAIN_', 
    'OFF_', 'SHIELD', 'CAPE'
  ];
  
  // Check if item matches any valid pattern
  for (const pattern of validPatterns) {
    if (upperItemId.includes(pattern)) {
      return true;
    }
  }
  
  console.log(`[FILTER] Excluded unknown item: ${itemId}`);
  return false;
};

/**
 * Fetch with retry and exponential backoff
 */
const fetchWithRetry = async (url, retries = 3, initialDelay = 1000) => {
  // Check global cooldown
  if (Date.now() < globalBlockUntil) {
    const waitTime = globalBlockUntil - Date.now();
    console.warn(`[GLOBAL COOLDOWN] Rate limited. Waiting ${waitTime}ms`);
    await sleep(waitTime);
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      requestCount++;
      const response = await fetch(url);

      if (response.status === 429) {
        rateLimitErrorCount++;
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : initialDelay * Math.pow(2, attempt);

        console.warn(`[429] Rate limited, retry ${attempt + 1}/${retries} after ${delay}ms`);

        // Set global cooldown to prevent storm of requests
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
      if (attempt === retries - 1) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`[ERROR] Fetch error, retry ${attempt + 1}/${retries} after ${delay}ms:`, error.message);
      await sleep(delay);
    }
  }
};

/**
 * Process request queue with concurrency limit
 */
const processQueue = async () => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
    return;
  }

  activeRequests++;
  const { resolve, reject, fn } = requestQueue.shift();

  try {
    const result = await fn();
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    activeRequests--;
    processQueue(); // Process next request in queue
  }
};

/**
 * Queue a request with concurrency limit
 */
const queueRequest = (fn) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, fn });
    processQueue();
  });
};

/**
 * Fetch price data for a specific item
 * @param {string} itemName - The item name (e.g., 'T4_BAG', 'T5_PLANKS')
 * @param {number} locations - Number of locations to fetch (default: 1 for Black Market)
 * @returns {Promise<Object>} Price data for the item
 */
export const fetchItemPrice = async (itemName, locations = 1) => {
  // Check cache first
  const cached = getCachedPrice(itemName);
  if (cached) {
    return cached;
  }

  try {
    console.log(`Fetching price for ${itemName} from Albion API`);

    // Queue the request to respect concurrency limit
    const response = await queueRequest(async () => {
      return await fetchWithRetry(`${ALBION_API_BASE}/${itemName}?locations=Black%20Market`);
    });

    const data = await response.json();
    const priceData = data[0] || null;

    // Cache the result
    if (priceData) {
      setCachedPrice(itemName, priceData);
    }

    console.log(`Price data for ${itemName}:`, priceData);
    return priceData;
  } catch (error) {
    console.error(`Error fetching price for ${itemName}:`, error);
    return null;
  }
};

/**
 * Fetch price data for multiple items across all arbitrage locations.
 *
 * Output shape is a normalized `priceData` object that mirrors what
 * `calculateArbitrage` expects:
 *
 *   {
 *     item_id: 'T4_BAG',
 *     locations: {
 *       'Black Market':  { buy_price_min, sell_price_min, buy_price_max, sell_price_max, ... },
 *       'Lymhurst':      { ... },
 *       ...
 *     },
 *     _source: 'cache' | 'api',
 *   }
 *
 * Cache lookup is per (item_id, location): if every supported location
 * for an item is cached and valid, the item is served entirely from
 * Supabase. Otherwise, the missing locations are fetched from the API.
 *
 * @param {Array<Object>} items - Array of item objects with itemId, enchantment, quantity
 * @param {boolean} hasPremium - Whether user has premium (affects transaction fee)
 * @param {Object} options - Fetch options
 * @param {Function} options.onProgress - Progress callback
 * @param {boolean} options.forceRefresh - Ignore Supabase cache and fetch fresh data
 * @returns {Promise<Array>} Array of normalized price data for all items
 */
export const fetchMultipleItemPrices = async (items, hasPremium = false, options = {}) => {
  const { onProgress, forceRefresh = false } = options;

  try {
    console.log(`[FETCH] Fetching prices for ${items.length} items (max ${MAX_CONCURRENT_REQUESTS} concurrent)`);
    const startTime = Date.now();

    // Filter out resource items before processing
    const validItems = items.filter(item => isValidEquipment(item.itemId));
    console.log(`[FILTER] Filtered ${items.length - validItems.length} resource items, ${validItems.length} equipment items remain`);

    if (validItems.length === 0) {
      console.warn('[FILTER] No valid equipment items to fetch');
      onProgress?.({ loaded: 0, total: 0, phase: 'complete' });
      return [];
    }

    onProgress?.({ loaded: 0, total: validItems.length, phase: 'cache' });

    // 1. Cache lookup (per location)
    const itemIds = validItems.map(item => item.itemId);
    const cachedByLocation = forceRefresh ? {} : await getCachedMarketPricesByLocation(itemIds);

    // Build a normalized cache state: itemId -> Set of cached valid locations
    const cachedLocationsByItem = new Map(); // itemId -> Map(location -> priceData)
    for (const itemId of itemIds) {
      const rows = cachedByLocation[itemId] || [];
      const validMap = new Map();
      rows.forEach((row) => {
        // Defensive: accept both camelCase (normalized by the adapter) and
        // snake_case (in case a future code path returns rows untransformed).
        const expiresAt = row.expiresAt ?? row.expires_at;
        const location = row.location ?? row.city;
        const priceData = row.priceData ?? row.price_data;
        if (!forceRefresh && location && isLocationCacheValid(expiresAt)) {
          validMap.set(location, priceData);
        }
      });
      cachedLocationsByItem.set(itemId, validMap);
    }

    // 2. Determine which items still need fresh fetches (and which locations)
    const uncachedItems = []; // items that need ANY API call
    const itemsFullyCached = [];

    validItems.forEach((item) => {
      const cachedMap = cachedLocationsByItem.get(item.itemId) || new Map();
      const missingLocations = ARBITRAGE_LOCATIONS.filter((loc) => !cachedMap.has(loc));

      if (missingLocations.length === 0) {
        itemsFullyCached.push({ item, cachedMap });
        console.log(`[CACHE HIT] ${item.itemId} - all ${cachedMap.size}/${ARBITRAGE_LOCATIONS.length} locations cached`);
      } else {
        uncachedItems.push(item);
        if (forceRefresh) {
          console.log(`[CACHE MISS] ${item.itemId} - force refresh of all locations`);
        } else {
          console.log(`[CACHE MISS] ${item.itemId} - missing ${missingLocations.length}/${ARBITRAGE_LOCATIONS.length} locations: ${missingLocations.join(', ')}`);
        }
      }
    });

    console.log(`[CACHE] ${itemsFullyCached.length} items fully cached, ${uncachedItems.length} items need API fetch`);
    onProgress?.({
      loaded: itemsFullyCached.length,
      total: validItems.length,
      phase: uncachedItems.length > 0 ? 'fetch' : 'complete',
    });

    // 3. Fetch missing items from the API (we always request ALL locations
    //    in one call - the API is fine with that and it's simpler).
    const fetchedByItem = new Map(); // itemId -> Map(location -> priceData)

    if (uncachedItems.length > 0) {
      const batches = chunkArray(uncachedItems, API_BATCH_SIZE);
      console.log(`[FETCH] Split ${uncachedItems.length} uncached items into ${batches.length} batches of ${API_BATCH_SIZE} items each`);

      const locationsParam = ARBITRAGE_LOCATIONS.map(encodeURIComponent).join(',');
      let loadedCount = itemsFullyCached.length;

      for (let i = 0; i < batches.length; i++) {
        console.log(`[FETCH] Processing batch ${i + 1}/${batches.length} (locations=${ARBITRAGE_LOCATIONS.length})`);

        const itemIdsBatch = batches[i].map(item => item.itemId).join(',');

        try {
          const response = await queueRequest(async () => {
            return await fetchWithRetry(`${ALBION_API_BASE}/${itemIdsBatch}?locations=${locationsParam}`);
          });

          const data = await response.json();

          // The API returns one row per (item, location).
          // Split each row into per-location cache entries AND keep the
          // normalized shape that calculateArbitrage expects.
          const upserts = [];
          let allZeroCount = 0;
          for (const row of data) {
            if (!row || !isValidEquipment(row.item_id)) {
              if (row) console.log(`[FILTER] Excluded resource item from API response: ${row.item_id}`);
              continue;
            }
            const loc = row.location || row.city;
            if (!loc || !ARBITRAGE_LOCATIONS.includes(loc)) {
              // Skip locations we don't care about
              continue;
            }

            // Sanitize: if the API returns all-zero for a (item, location)
            // pair the community has no recent sale/buy order, so we
            // don't cache it AND we don't include it in the calculation.
            const sanitized = sanitizePriceData(row);
            if (!sanitized.ok) {
              allZeroCount++;
              // eslint-disable-next-line no-console
              console.warn(
                `[ALBION][NO_DATA] ${row.item_id} @ ${loc} (${sanitized.reason}) - Sem dados recentes.`
              );
              continue;
            }

            if (!fetchedByItem.has(row.item_id)) fetchedByItem.set(row.item_id, new Map());
            fetchedByItem.get(row.item_id).set(loc, sanitized.data);

            upserts.push({
              itemId: row.item_id,
              location: loc,
              priceData: sanitized.data,
            });
          }

          if (allZeroCount > 0) {
            console.warn(
              `[ALBION][NO_DATA] ${allZeroCount} (item, location) pair(s) descartados por falta de dados recentes.`
            );
          }

          // Persist to Supabase (one row per location)
          if (upserts.length > 0) {
            await setCachedMarketPricesByLocation(upserts);
            console.log(`[SUPABASE CACHE BY LOCATION] Persisted ${upserts.length} (item, location) rows`);
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
          const delay = 1000 + Math.random() * 500;
          console.log(`[FETCH] Waiting ${delay}ms before next batch`);
          await sleep(delay);
        }
      }
    }

    // 4. Combine cached + freshly fetched data into the normalized shape
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

      if (Object.keys(locations).length === 0) {
        console.log(`[FETCH] ${item.itemId} has no price data at any supported location`);
        continue;
      }

      allResults.push({
        item_id: item.itemId,
        locations,
        _source: fromApiCount > 0 ? 'mixed' : 'cache',
        _stats: { fromCacheCount, fromApiCount },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[FETCH] Assembled ${allResults.length}/${validItems.length} price snapshots in ${duration}ms`);
    console.log(`[FETCH] Request stats: ${requestCount} total requests, ${rateLimitErrorCount} rate limit errors, cache hits: ${cacheHits}, misses: ${cacheMisses}`);

    return allResults;
  } catch (error) {
    console.error('[FETCH] Error fetching multiple item prices:', error);
    return [];
  }
};

/**
 * Calculate arbitrage opportunity for an item.
 *
 * Compares a City (where we buy at the cheapest seller's `buy_price_min`,
 * i.e. the lowest price an item is being listed at) against the Black
 * Market (where we sell at `buy_price_max`, the highest instant-buy offer).
 *
 * Important rules:
 *   - The buy and sell locations MUST be different (skip same-location).
 *   - The Black Market row is required for the calculation; if missing,
 *     no opportunity is emitted.
 *   - At least one non-BM city must have a positive buy price.
 *
 * @param {Object} priceData - Normalized snapshot from fetchMultipleItemPrices
 *                             Shape: { item_id, locations: { [city]: { buy_price_min, ... } } }
 * @param {string} targetCity - Target city (always 'Black Market' by default)
 * @param {boolean} hasPremium - Whether user has premium (affects transaction fee)
 * @returns {Object|null} Arbitrage opportunity data, or null when invalid
 */
export const calculateArbitrage = (priceData, targetCity = BLACK_MARKET, hasPremium = false) => {
  if (!priceData) return null;

  const itemId = priceData.item_id;
  if (!isValidEquipment(itemId)) {
    console.log(`[FILTER] Skipping calculation for resource item: ${itemId}`);
    return null;
  }

  // Support both the new normalized shape (`priceData.locations`) and the
  // legacy shape (`priceData.data`) for backwards compatibility.
  const locations = priceData.locations || priceData.data;
  if (!locations || typeof locations !== 'object') return null;

  const bmEntry = locations[BLACK_MARKET];
  if (!bmEntry) {
    // No Black Market data => can't compute an arbitrage that sells there.
    return null;
  }

  // We sell to the Black Market. The "instant sell" price is the highest
  // buy order (`buy_price_max`); if that is not available we fall back to
  // the lowest listed sell price (`sell_price_min`) which represents the
  // cheapest competing seller (still a reasonable proxy).
  const bmSellPrice = bmEntry.buy_price_max > 0
    ? bmEntry.buy_price_max
    : (bmEntry.sell_price_min || 0);

  // [DEBUG] Missing price diagnostic
  if (bmSellPrice <= 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[DEBUG][calculateArbitrage] Missing Black Market price for ${itemId}. ` +
      `bmEntry=${JSON.stringify(bmEntry)}`
    );
    return null;
  }

  // Find the cheapest city to buy from (anywhere that is NOT the target).
  let bestBuy = null;
  for (const [city, entry] of Object.entries(locations)) {
    if (city === targetCity) continue; // ignore same-location pairs
    if (!entry || typeof entry !== 'object') continue;

    const buyPrice = entry.buy_price_min;
    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      // [DEBUG] Missing price diagnostic
      // eslint-disable-next-line no-console
      console.warn(
        `[DEBUG][calculateArbitrage] Missing price for ${itemId} @ ${city}. ` +
        `entry=${JSON.stringify(entry)}`
      );
      continue;
    }

    if (!bestBuy || buyPrice < bestBuy.price) {
      bestBuy = { city, price: buyPrice };
    }
  }

  if (!bestBuy) {
    // eslint-disable-next-line no-console
    console.warn(
      `[DEBUG][calculateArbitrage] ${itemId} has Black Market price (${bmSellPrice}) ` +
      `but no valid city buy price. locations=${JSON.stringify(locations)}`
    );
    return null;
  }

  // Black Market fees
  // Setup fee: 2.5% of sell price (fixed)
  // Transaction fee: 3.5% without premium, 2.5% with premium
  const setupFee = bmSellPrice * 0.025;
  const transactionFeeRate = hasPremium ? 0.025 : 0.035;
  const transactionFee = bmSellPrice * transactionFeeRate;
  const totalFees = setupFee + transactionFee;

  const grossProfit = bmSellPrice - bestBuy.price;
  const netProfit = grossProfit - totalFees;
  const margin = bestBuy.price > 0 ? ((netProfit / bestBuy.price) * 100) : 0;

  // [DEBUG] Deep inspection for the first 5 items processed
  // eslint-disable-next-line no-console
  if (!calculateArbitrage.__debugCount) calculateArbitrage.__debugCount = 0;
  if (calculateArbitrage.__debugCount < 5) {
    calculateArbitrage.__debugCount++;
    // eslint-disable-next-line no-console
    console.log(
      `[DEBUG][calculateArbitrage] #${calculateArbitrage.__debugCount}`,
      JSON.stringify({
        item: itemId,
        pair: `${bestBuy.city} -> ${targetCity}`,
        buyPrice: bestBuy.price,
        bmPrice: bmSellPrice,
        bmFound: Number.isFinite(bmSellPrice) && bmSellPrice > 0,
        setupFee,
        transactionFee,
        totalFees,
        grossProfit,
        netProfit,
        margin: Number(margin.toFixed(2)),
      })
    );
  }

  // Calculate risk and efficiency
  const risk = getRouteRisk(bestBuy.city, targetCity);
  const travelTime = getTravelTime(bestBuy.city, targetCity);
  const expectedProfit = calculateExpectedProfit(netProfit, risk.value);
  const efficiency = calculateEfficiency(netProfit, travelTime);
  const riskAdjustedEfficiency = calculateRiskAdjustedEfficiency(netProfit, travelTime, risk.value);

  // Calculate saturation-adjusted price
  const saturationLevel = getSaturationLevel(itemId);
  const saturationAdjustedPrice = calculateSaturationAdjustedPrice(itemId, bmSellPrice);
  const saturationAdjustedProfit = saturationAdjustedPrice - bestBuy.price - totalFees;

  return {
    itemId: itemId,
    itemName: itemId,
    buyCity: bestBuy.city,
    buyPrice: bestBuy.price,
    sellCity: targetCity,
    bmPrice: bmSellPrice,
    grossProfit: grossProfit,
    setupFee: setupFee,
    transactionFee: transactionFee,
    totalFees: totalFees,
    netProfit: netProfit,
    margin: margin,
    risk: risk,
    travelTime: travelTime,
    expectedProfit: expectedProfit,
    efficiency: efficiency,
    riskAdjustedEfficiency: riskAdjustedEfficiency,
    saturation: saturationLevel,
    saturationAdjustedProfit: saturationAdjustedProfit,
    saturationWarning: getSaturationWarning(itemId),
    hasPremium: hasPremium,
    // Back-compat aliases (older UI may still read these)
    lowestCity: bestBuy.city,
    lowestPrice: bestBuy.price,
  };
};

/**
 * Fetch top arbitrage opportunities for a list of items
 * @param {Array<Object>} items - Array of item objects with itemId, enchantment, quantity
 * @param {number} limit - Number of top opportunities to return
 * @param {boolean} hasPremium - Whether user has premium (affects transaction fee)
 * @param {Object} options - Fetch options
 * @param {boolean} options.includeAllTiers - Include T6-T8 items instead of only initial T4/T5 items
 * @param {Function} options.onProgress - Progress callback
 * @param {boolean} options.forceRefresh - Ignore Supabase cache and fetch fresh data
 * @returns {Promise<Array>} Array of top arbitrage opportunities
 */
export const fetchTopOpportunities = async (items, limit = 10, hasPremium = false, options = {}) => {
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

  // Single-flight: if the same request is already in flight, return the same promise
  const requestKey = generateCanonicalKey(selectedItems, limit);
  
  if (inFlightRequests.has(requestKey)) {
    console.log(`[SINGLE-FLIGHT] Reusing in-flight request for ${selectedItems.length} items`);
    return inFlightRequests.get(requestKey);
  }

  const requestPromise = (async () => {
    try {
      console.log(`[FETCH] Fetching top opportunities for ${selectedItems.length}/${items.length} items (key: ${requestKey.substring(0, 50)}...)`);

      // Load dynamic thresholds (min profit, min margin) before filtering
      const settings = await getMarketSettings();

      const priceData = await fetchMultipleItemPrices(selectedItems, premium, { onProgress, forceRefresh });
      console.log(`[FETCH] Received price data for ${priceData.length} items`);

      if (priceData.length === 0) {
        console.warn('[FETCH] No price data received from API');
        return [];
      }

      // Track cache vs API provenance for visibility
      const sourceStats = { cache: 0, mixed: 0, api: 0 };
      priceData.forEach((d) => {
        if (d._source === 'cache') sourceStats.cache++;
        else if (d._source === 'mixed') sourceStats.mixed++;
        else sourceStats.api++;
      });
      console.log(`[FETCH] Price source breakdown: cache=${sourceStats.cache}, mixed=${sourceStats.mixed}, api=${sourceStats.api}`);

      const itemMetadataById = new Map(selectedItems.map(item => [item.itemId, item]));

      // Map price data with item metadata, calculate arbitrage, apply filters
      // [DEBUG] Temporarily ignore MIN_PROFIT and MIN_MARGIN_PCT to see any opportunity.
      // Flip DEBUG_DISABLE_THRESHOLDS to false once we understand the data shape.
      const DEBUG_DISABLE_THRESHOLDS = true;
      const effectiveMinProfit = DEBUG_DISABLE_THRESHOLDS ? 0 : settings.minProfit;
      const effectiveMinMarginPct = DEBUG_DISABLE_THRESHOLDS ? 0 : settings.minMarginPct * 100;

      let filteredOutByProfit = 0;
      let filteredOutByMargin = 0;
      let filteredOutByNull = 0;

      const opportunities = priceData
        .map((data) => {
          const itemMetadata = itemMetadataById.get(data.item_id) || { enchantment: 0, quantity: 1 };
          const arbitrage = calculateArbitrage(data, BLACK_MARKET, premium);
          if (!arbitrage) {
            filteredOutByNull++;
            return null;
          }
          return {
            ...arbitrage,
            enchantment: itemMetadata.enchantment,
            quantity: itemMetadata.quantity,
          };
        })
        .filter((opp) => {
          if (!opp) return false;
          if (opp.netProfit < effectiveMinProfit) {
            filteredOutByProfit++;
            return false;
          }
          if (opp.margin < effectiveMinMarginPct) {
            filteredOutByMargin++;
            return false;
          }
          return true;
        })
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, limit);

      console.log(
        `[FETCH] Calculated ${opportunities.length} profitable opportunities ` +
        `(filter: netProfit>=${effectiveMinProfit}, margin>=${effectiveMinMarginPct.toFixed(2)}% ` +
        `[DEBUG thresholds: ${DEBUG_DISABLE_THRESHOLDS ? 'OFF' : 'ON'}])`
      );
      console.log(
        `[FETCH][DEBUG] Filtered out: ${filteredOutByNull} null (no BM or no buy city), ` +
        `${filteredOutByProfit} by netProfit < ${effectiveMinProfit}, ` +
        `${filteredOutByMargin} by margin < ${effectiveMinMarginPct.toFixed(2)}%`
      );

      return opportunities;
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

// Common items to check for arbitrage with enchantment and quantity
// Only equipable items that can be sold in Black Market (Weapons, Armor, Bags, Shoes, Head, Capes)
// Resource-only item patterns are excluded before fetching prices
export const COMMON_ITEMS = [
  { itemId: 'T4_BAG', enchantment: 0, quantity: 1 },
  { itemId: 'T5_BAG', enchantment: 0, quantity: 1 },
  { itemId: 'T6_BAG', enchantment: 0, quantity: 1 },
  { itemId: 'T7_BAG', enchantment: 0, quantity: 1 },
  { itemId: 'T8_BAG', enchantment: 0, quantity: 1 },
  { itemId: 'T4_HEAD_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_HEAD_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_HEAD_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_HEAD_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_HEAD_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_HEAD_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T5_HEAD_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T6_HEAD_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T7_HEAD_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T8_HEAD_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T4_HEAD_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T5_HEAD_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T6_HEAD_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T7_HEAD_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T8_HEAD_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T4_ARMOR_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_ARMOR_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_ARMOR_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_ARMOR_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_ARMOR_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_ARMOR_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T5_ARMOR_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T6_ARMOR_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T7_ARMOR_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T8_ARMOR_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T4_ARMOR_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T5_ARMOR_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T6_ARMOR_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T7_ARMOR_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T8_ARMOR_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T4_SHOES_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_SHOES_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_SHOES_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_SHOES_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_SHOES_PLATE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_SHOES_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T5_SHOES_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T6_SHOES_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T7_SHOES_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T8_SHOES_CLOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T4_SHOES_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T5_SHOES_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T6_SHOES_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T7_SHOES_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T8_SHOES_LEATHER', enchantment: 0, quantity: 1 },
  { itemId: 'T4_MAIN_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MAIN_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MAIN_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MAIN_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MAIN_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_MAIN_SWORD', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MAIN_SWORD', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MAIN_SWORD', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MAIN_SWORD', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MAIN_SWORD', enchantment: 0, quantity: 1 },
  { itemId: 'T4_MAIN_MACE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MAIN_MACE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MAIN_MACE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MAIN_MACE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MAIN_MACE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_MAIN_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MAIN_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MAIN_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MAIN_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MAIN_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T4_MAIN_QUARTERSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MAIN_QUARTERSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MAIN_QUARTERSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MAIN_QUARTERSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MAIN_QUARTERSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T4_OFF_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_OFF_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_OFF_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_OFF_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_OFF_AXE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_OFF_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T5_OFF_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T6_OFF_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T7_OFF_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T8_OFF_DAGGER', enchantment: 0, quantity: 1 },
  { itemId: 'T4_OFF_HOLY', enchantment: 0, quantity: 1 },
  { itemId: 'T5_OFF_HOLY', enchantment: 0, quantity: 1 },
  { itemId: 'T6_OFF_HOLY', enchantment: 0, quantity: 1 },
  { itemId: 'T7_OFF_HOLY', enchantment: 0, quantity: 1 },
  { itemId: 'T8_OFF_HOLY', enchantment: 0, quantity: 1 },
  { itemId: 'T4_OFF_NATURE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_OFF_NATURE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_OFF_NATURE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_OFF_NATURE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_OFF_NATURE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_OFF_ARCANESTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T5_OFF_ARCANESTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T6_OFF_ARCANESTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T7_OFF_ARCANESTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T8_OFF_ARCANESTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T4_OFF_DEMONICSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T5_OFF_DEMONICSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T6_OFF_DEMONICSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T7_OFF_DEMONICSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T8_OFF_DEMONICSTAFF', enchantment: 0, quantity: 1 },
  { itemId: 'T4_OFF_CROSSBOW', enchantment: 0, quantity: 1 },
  { itemId: 'T5_OFF_CROSSBOW', enchantment: 0, quantity: 1 },
  { itemId: 'T6_OFF_CROSSBOW', enchantment: 0, quantity: 1 },
  { itemId: 'T7_OFF_CROSSBOW', enchantment: 0, quantity: 1 },
  { itemId: 'T8_OFF_CROSSBOW', enchantment: 0, quantity: 1 },
  { itemId: 'T4_OFF_TORCH', enchantment: 0, quantity: 1 },
  { itemId: 'T5_OFF_TORCH', enchantment: 0, quantity: 1 },
  { itemId: 'T6_OFF_TORCH', enchantment: 0, quantity: 1 },
  { itemId: 'T7_OFF_TORCH', enchantment: 0, quantity: 1 },
  { itemId: 'T8_OFF_TORCH', enchantment: 0, quantity: 1 },
  { itemId: 'T4_SHIELD', enchantment: 0, quantity: 1 },
  { itemId: 'T5_SHIELD', enchantment: 0, quantity: 1 },
  { itemId: 'T6_SHIELD', enchantment: 0, quantity: 1 },
  { itemId: 'T7_SHIELD', enchantment: 0, quantity: 1 },
  { itemId: 'T8_SHIELD', enchantment: 0, quantity: 1 },
  { itemId: 'T4_CAPE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_CAPE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_CAPE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_CAPE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_CAPE', enchantment: 0, quantity: 1 },
];
