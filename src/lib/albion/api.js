import { getRouteRisk, calculateExpectedProfit, getTravelTime, calculateEfficiency, calculateRiskAdjustedEfficiency } from './riskMap';
import { getSaturationLevel, calculateSaturationAdjustedPrice, getSaturationWarning } from './saturation';
import { getCachedMarketPrices, setCachedMarketPrice, isCacheValid } from '@/lib/supabase/marketCache';

const ALBION_API_BASE = 'https://www.albion-online-data.com/api/v2/stats/prices';

// Cache with TTL (10 minutes - increased to reduce API calls)
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
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
 * Mock data for when API fails or is unavailable
 */
const MOCK_OPPORTUNITIES = [
  {
    itemId: 'T6_BAG',
    itemName: 'T6_BAG',
    lowestCity: 'Martlock',
    lowestPrice: 45000,
    bmPrice: 75000,
    netProfit: 30000,
    margin: 66.7,
  },
  {
    itemId: 'T6_PLANKS',
    itemName: 'T6_PLANKS',
    lowestCity: 'Thetford',
    lowestPrice: 12000,
    bmPrice: 28000,
    netProfit: 16000,
    margin: 133.3,
  },
  {
    itemId: 'T6_METALBAR',
    itemName: 'T6_METALBAR',
    lowestCity: 'Fort Sterling',
    lowestPrice: 8000,
    bmPrice: 22000,
    netProfit: 14000,
    margin: 175.0,
  },
  {
    itemId: 'T5_BAG',
    itemName: 'T5_BAG',
    lowestCity: 'Lymhurst',
    lowestPrice: 15000,
    bmPrice: 32000,
    netProfit: 17000,
    margin: 113.3,
  },
  {
    itemId: 'T5_PLANKS',
    itemName: 'T5_PLANKS',
    lowestCity: 'Martlock',
    lowestPrice: 4000,
    bmPrice: 12000,
    netProfit: 8000,
    margin: 200.0,
  },
];

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
 * @returns {Promise<Array>} Array of price data for all items
 */
export const fetchMultipleItemPrices = async (items, hasPremium = false) => {
  try {
    console.log(`[FETCH] Fetching prices for ${items.length} items (max ${MAX_CONCURRENT_REQUESTS} concurrent)`);
    const startTime = Date.now();

    // First, check Supabase cache for all items
    const itemIds = items.map(item => item.itemId);
    const cachedPrices = await getCachedMarketPrices(itemIds);

    // Separate items into cached and uncached
    const cachedItems = [];
    const uncachedItems = [];

    items.forEach((item) => {
      const cached = cachedPrices[item.itemId];
      if (cached && isCacheValid(cached.expiresAt)) {
        cachedItems.push({
          item,
          priceData: cached.priceData,
        });
        console.log(`[CACHE HIT] ${item.itemId} from Supabase`);
      } else {
        uncachedItems.push(item);
        console.log(`[CACHE MISS] ${item.itemId} - will fetch from API`);
      }
    });

    console.log(`[CACHE] ${cachedItems.length} items from cache, ${uncachedItems.length} items to fetch`);

    // Fetch uncached items from API in batches
    const BATCH_SIZE = 100; // Increased to 100 for API batch requests
    const batches = [];
    for (let i = 0; i < uncachedItems.length; i += BATCH_SIZE) {
      batches.push(uncachedItems.slice(i, i + BATCH_SIZE));
    }

    console.log(`[FETCH] Split ${uncachedItems.length} uncached items into ${batches.length} batches of ${BATCH_SIZE} items each`);

    const fetchedResults = [];
    for (let i = 0; i < batches.length; i++) {
      console.log(`[FETCH] Processing batch ${i + 1}/${batches.length}`);
      
      // Build comma-separated item IDs for batch API request
      const itemIdsBatch = batches[i].map(item => item.itemId).join(',');
      
      try {
        const response = await queueRequest(async () => {
          return await fetchWithRetry(`${ALBION_API_BASE}/${itemIdsBatch}?locations=Black%20Market`);
        });

        const data = await response.json();
        
        // Cache the fetched data in Supabase
        for (const priceData of data) {
          if (priceData) {
            await setCachedMarketPrice(priceData.item_id, priceData);
            fetchedResults.push(priceData);
          }
        }
      } catch (error) {
        console.error(`[FETCH] Error fetching batch ${i + 1}:`, error);
      }

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
    console.log(`[FETCH] Fetched ${allResults.length}/${items.length} prices in ${duration}ms`);
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
 * @returns {Promise<Array>} Array of top arbitrage opportunities
 */
export const fetchTopOpportunities = async (items, limit = 10, hasPremium = false) => {
  // Single-flight: if the same request is already in flight, return the same promise
  const requestKey = generateCanonicalKey(items, limit);
  
  if (inFlightRequests.has(requestKey)) {
    console.log(`[SINGLE-FLIGHT] Reusing in-flight request for ${items.length} items`);
    return inFlightRequests.get(requestKey);
  }

  const requestPromise = (async () => {
    try {
      console.log(`[FETCH] Fetching top opportunities for ${items.length} items (key: ${requestKey.substring(0, 50)}...)`);
      const priceData = await fetchMultipleItemPrices(items, hasPremium);
      console.log(`[FETCH] Received price data for ${priceData.length} items`);
      
      if (priceData.length === 0) {
        console.warn('[FETCH] No price data received from API, using mock data');
        return MOCK_OPPORTUNITIES.slice(0, limit);
      }
      
      // Map price data with item metadata
      const opportunities = priceData
        .map((data, index) => {
          const itemMetadata = items[index] || { enchantment: 0, quantity: 1 };
          const arbitrage = calculateArbitrage(data, 'Black Market', hasPremium);
          if (arbitrage) {
            return {
              ...arbitrage,
              enchantment: itemMetadata.enchantment,
              quantity: itemMetadata.quantity,
            };
          }
          return null;
        })
        .filter(opp => opp !== null && opp.netProfit > 0)
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, limit);

      console.log(`[FETCH] Calculated ${opportunities.length} profitable opportunities`);
      
      if (opportunities.length === 0) {
        console.warn('[FETCH] No profitable opportunities found, using mock data');
        return MOCK_OPPORTUNITIES.slice(0, limit);
      }
      
      return opportunities;
    } catch (error) {
      console.error('[FETCH] Error fetching top opportunities:', error);
      console.warn('[FETCH] API failed, using mock data');
      return MOCK_OPPORTUNITIES.slice(0, limit);
    } finally {
      inFlightRequests.delete(requestKey);
    }
  })();

  inFlightRequests.set(requestKey, requestPromise);
  return requestPromise;
};

// Common items to check for arbitrage with enchantment and quantity
// Only equipable items that can be sold in Black Market (Weapons, Armor, Bags, Capes, Mounts)
// Excluded: Resources (Wood, Planks, Ore, MetalBars, Fiber, Cloth, Hide, Leather, Rock, StoneBlocks)
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
  // Mounts
  { itemId: 'T4_MOUNT_HORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MOUNT_HORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MOUNT_HORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MOUNT_HORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MOUNT_HORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_MOUNT_ARMOREDHORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MOUNT_ARMOREDHORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MOUNT_ARMOREDHORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MOUNT_ARMOREDHORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MOUNT_ARMOREDHORSE', enchantment: 0, quantity: 1 },
  { itemId: 'T4_MOUNT_DIREWOLF', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MOUNT_DIREWOLF', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MOUNT_DIREWOLF', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MOUNT_DIREWOLF', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MOUNT_DIREWOLF', enchantment: 0, quantity: 1 },
  { itemId: 'T4_MOUNT_MAMMOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T5_MOUNT_MAMMOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T6_MOUNT_MAMMOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T7_MOUNT_MAMMOTH', enchantment: 0, quantity: 1 },
  { itemId: 'T8_MOUNT_MAMMOTH', enchantment: 0, quantity: 1 },
];
