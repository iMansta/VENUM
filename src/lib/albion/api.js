import { getRouteRisk, calculateExpectedProfit, getTravelTime, calculateEfficiency, calculateRiskAdjustedEfficiency } from './riskMap';
import { getSaturationLevel, calculateSaturationAdjustedPrice, getSaturationWarning } from './saturation';
import { getCachedMarketPrices, setCachedMarketPrice, isCacheValid } from '@/lib/supabase/marketCache';

const ALBION_API_BASE = 'https://www.albion-online-data.com/api/v2/stats/prices';

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
 * Fetch price data for multiple items with Supabase cache
 * @param {Array<Object>} items - Array of item objects with itemId, enchantment, quantity
 * @param {boolean} hasPremium - Whether user has premium (affects transaction fee)
 * @param {Object} options - Fetch options
 * @param {Function} options.onProgress - Progress callback
 * @param {boolean} options.forceRefresh - Ignore Supabase cache and fetch fresh data
 * @returns {Promise<Array>} Array of price data for all items
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

    // First, check Supabase cache for all items unless a fresh pull is requested
    const itemIds = validItems.map(item => item.itemId);
    const cachedPrices = forceRefresh ? {} : await getCachedMarketPrices(itemIds);

    // Separate items into cached and uncached
    const cachedItems = [];
    const uncachedItems = [];

    validItems.forEach((item) => {
      const cached = cachedPrices[item.itemId];
      if (!forceRefresh && cached && isCacheValid(cached.expiresAt)) {
        cachedItems.push({
          item,
          priceData: cached.priceData,
        });
        console.log(`[CACHE HIT] ${item.itemId} from Supabase`);
      } else {
        uncachedItems.push(item);
        console.log(`[CACHE MISS] ${item.itemId} - will fetch from API${forceRefresh ? ' (force refresh)' : ''}`);
      }
    });

    console.log(`[CACHE] ${cachedItems.length} items from cache, ${uncachedItems.length} items to fetch`);
    onProgress?.({
      loaded: cachedItems.length,
      total: validItems.length,
      phase: uncachedItems.length > 0 ? 'fetch' : 'complete',
    });

    // Fetch uncached items from API in batches
    const batches = chunkArray(uncachedItems, API_BATCH_SIZE);

    console.log(`[FETCH] Split ${uncachedItems.length} uncached items into ${batches.length} batches of ${API_BATCH_SIZE} items each`);

    const fetchedResults = [];
    let loadedCount = cachedItems.length;

    for (let i = 0; i < batches.length; i++) {
      console.log(`[FETCH] Processing batch ${i + 1}/${batches.length}`);
      
      // Build comma-separated item IDs for batch API request
      const itemIdsBatch = batches[i].map(item => item.itemId).join(',');
      
      try {
        const response = await queueRequest(async () => {
          return await fetchWithRetry(`${ALBION_API_BASE}/${itemIdsBatch}?locations=Black%20Market`);
        });

        const data = await response.json();
        
        // Cache the fetched data in Supabase and filter out resource items
        for (const priceData of data) {
          if (priceData && isValidEquipment(priceData.item_id)) {
            await setCachedMarketPrice(priceData.item_id, priceData);
            fetchedResults.push(priceData);
          } else if (priceData) {
            console.log(`[FILTER] Excluded resource item from API response: ${priceData.item_id}`);
          }
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

      // Add delay between batches to reduce burst
      if (i < batches.length - 1) {
        const delay = 1000 + Math.random() * 500; // 1000-1500ms delay
        console.log(`[FETCH] Waiting ${delay}ms before next batch`);
        await sleep(delay);
      }
    }

    // Combine cached and fetched results
    const allResults = [
      ...cachedItems.map(c => c.priceData),
      ...fetchedResults,
    ];

    const duration = Date.now() - startTime;
    console.log(`[FETCH] Fetched ${allResults.length}/${validItems.length} prices in ${duration}ms`);
    console.log(`[FETCH] Request stats: ${requestCount} total requests, ${rateLimitErrorCount} rate limit errors, cache hits: ${cacheHits}, misses: ${cacheMisses}`);

    return allResults;
  } catch (error) {
    console.error('[FETCH] Error fetching multiple item prices:', error);
    return [];
  }
};

/**
 * Calculate arbitrage opportunity for an item
 * @param {Object} priceData - Price data from Albion API
 * @param {string} targetCity - Target city (default: 'Black Market')
 * @param {boolean} hasPremium - Whether user has premium (affects transaction fee)
 * @returns {Object|null} Arbitrage opportunity data
 */
export const calculateArbitrage = (priceData, targetCity = 'Black Market', hasPremium = false) => {
  if (!priceData) return null;

  // Validate that the item is equipment (can be sold in Black Market)
  if (!isValidEquipment(priceData.item_id)) {
    console.log(`[FILTER] Skipping calculation for resource item: ${priceData.item_id}`);
    return null;
  }

  const bmPrice = priceData.data?.['Black Market']?.sell_price_min || 0;
  const lowestCity = Object.entries(priceData.data || {})
    .filter(([city]) => city !== 'Black Market')
    .reduce((lowest, [city, data]) => {
      const buyPrice = data.buy_price_min || Infinity;
      return buyPrice < lowest.price ? { city, price: buyPrice } : lowest;
    }, { city: 'Unknown', price: Infinity });

  if (lowestCity.price === Infinity) return null;

  // Black Market fees
  // Setup fee: 2.5% of sell price (fixed)
  // Transaction fee: 3.5% without premium, 2.5% with premium
  const setupFee = bmPrice * 0.025;
  const transactionFeeRate = hasPremium ? 0.025 : 0.035;
  const transactionFee = bmPrice * transactionFeeRate;
  const totalFees = setupFee + transactionFee;

  const grossProfit = bmPrice - lowestCity.price;
  const netProfit = grossProfit - totalFees;
  const margin = lowestCity.price > 0 ? ((netProfit / lowestCity.price) * 100) : 0;

  // Calculate risk and efficiency
  const risk = getRouteRisk(lowestCity.city, targetCity);
  const travelTime = getTravelTime(lowestCity.city, targetCity);
  const expectedProfit = calculateExpectedProfit(netProfit, risk.value);
  const efficiency = calculateEfficiency(netProfit, travelTime);
  const riskAdjustedEfficiency = calculateRiskAdjustedEfficiency(netProfit, travelTime, risk.value);

  // Calculate saturation-adjusted price
  const saturationLevel = getSaturationLevel(priceData.item_id);
  const saturationAdjustedPrice = calculateSaturationAdjustedPrice(priceData.item_id, bmPrice);
  const saturationAdjustedProfit = saturationAdjustedPrice - lowestCity.price - totalFees;

  return {
    itemId: priceData.item_id,
    itemName: priceData.item_id,
    lowestCity: lowestCity.city,
    lowestPrice: lowestCity.price,
    bmPrice: bmPrice,
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
    saturationWarning: getSaturationWarning(priceData.item_id),
    hasPremium: hasPremium,
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
      const priceData = await fetchMultipleItemPrices(selectedItems, premium, { onProgress, forceRefresh });
      console.log(`[FETCH] Received price data for ${priceData.length} items`);
      
      if (priceData.length === 0) {
        console.warn('[FETCH] No price data received from API');
        return [];
      }
      
      const itemMetadataById = new Map(selectedItems.map(item => [item.itemId, item]));

      // Map price data with item metadata
      const opportunities = priceData
        .map((data) => {
          const itemMetadata = itemMetadataById.get(data.item_id) || { enchantment: 0, quantity: 1 };
          const arbitrage = calculateArbitrage(data, 'Black Market', premium);
          if (arbitrage) {
            return {
              ...arbitrage,
              enchantment: itemMetadata.enchantment,
              quantity: itemMetadata.quantity,
            };
          }
          return null;
        })
        .filter(opp => opp !== null && opp.netProfit >= 0)
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, limit);

      console.log(`[FETCH] Calculated ${opportunities.length} profitable opportunities`);
      
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
