import { supabase } from './client';

/**
 * Market Prices Cache Service
 * Manages caching of Albion Online market prices in Supabase
 */

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Get cached market prices from Supabase
 * @param {Array<string>} itemIds - Array of item IDs to fetch
 * @returns {Promise<Object>} Map of item_id to cached price data
 */
export const getCachedMarketPrices = async (itemIds) => {
  try {
    const { data, error } = await supabase.rpc('get_cached_market_prices', {
      p_item_ids: itemIds,
    });

    if (error) throw error;

    // Convert array to map for easy lookup
    const cacheMap = {};
    data.forEach((item) => {
      cacheMap[item.item_id] = {
        priceData: item.price_data,
        cachedAt: item.cached_at,
        expiresAt: item.expires_at,
      };
    });

    console.log(`[SUPABASE CACHE] Retrieved ${data.length} cached items`);
    return cacheMap;
  } catch (error) {
    console.error('[SUPABASE CACHE] Error fetching cached prices:', error);
    return {};
  }
};

/**
 * Set cached market price in Supabase
 * @param {string} itemId - Item ID
 * @param {Object} priceData - Price data to cache
 * @returns {Promise<boolean>} Success status
 */
export const setCachedMarketPrice = async (itemId, priceData) => {
  try {
    const { error } = await supabase.rpc('set_cached_market_prices', {
      p_item_id: itemId,
      p_price_data: priceData,
    });

    if (error) throw error;

    console.log(`[SUPABASE CACHE] Cached price for ${itemId}`);
    return true;
  } catch (error) {
    console.error(`[SUPABASE CACHE] Error caching price for ${itemId}:`, error);
    return false;
  }
};

/**
 * Clear expired cache entries
 * @returns {Promise<number>} Number of deleted entries
 */
export const clearExpiredCache = async () => {
  try {
    const { data, error } = await supabase.rpc('clear_expired_market_cache');

    if (error) throw error;

    console.log(`[SUPABASE CACHE] Cleared ${data} expired entries`);
    return data;
  } catch (error) {
    console.error('[SUPABASE CACHE] Error clearing expired cache:', error);
    return 0;
  }
};

/**
 * Check if cached data is still valid
 * @param {string} expiresAt - Expiration timestamp
 * @returns {boolean} Whether cache is still valid
 */
export const isCacheValid = (expiresAt) => {
  if (!expiresAt) return false;
  const expiresTime = new Date(expiresAt).getTime();
  return expiresTime > Date.now();
};
