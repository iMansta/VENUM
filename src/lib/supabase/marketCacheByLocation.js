import { supabase } from './client';

/**
 * Per-Location Market Prices Cache Service
 *
 * Stores Albion Online prices as one row per (item_id, location).
 * This is the new shape used by the arbitrage refactor, where the
 * comparison happens between City (buy_price_min) and Black Market
 * (buy_price_max).
 *
 * Coexists with `marketCache.js` (the old JSONB-blob cache). Old
 * callers keep working; the arbitrage pipeline uses this module.
 */

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Get cached prices grouped by item_id, each containing the list of
 * cached locations with their respective price_data.
 *
 * @param {Array<string>} itemIds - Item IDs to look up
 * @returns {Promise<Record<string, Array<{location: string, priceData: object, expiresAt: string}>>>}
 */
export const getCachedMarketPricesByLocation = async (itemIds) => {
  try {
    const { data, error } = await supabase.rpc(
      'get_cached_market_prices_by_location',
      { p_item_ids: itemIds }
    );

    if (error) throw error;

    const grouped = {};
    (data || []).forEach((row) => {
      if (!grouped[row.item_id]) grouped[row.item_id] = [];
      grouped[row.item_id].push({
        location: row.location,
        priceData: row.price_data,
        cachedAt: row.cached_at,
        expiresAt: row.expires_at,
      });
    });

    console.log(
      `[SUPABASE CACHE BY LOCATION] Retrieved ${data?.length || 0} rows for ${itemIds.length} items`
    );
    return grouped;
  } catch (error) {
    console.error('[SUPABASE CACHE BY LOCATION] Error fetching cached prices:', error);
    return {};
  }
};

/**
 * Upsert a single (item_id, location) price record.
 *
 * @param {string} itemId
 * @param {string} location
 * @param {object} priceData - Arbitrary JSONB payload
 * @returns {Promise<boolean>}
 */
export const setCachedMarketPriceByLocation = async (itemId, location, priceData) => {
  try {
    const { error } = await supabase.rpc('set_cached_market_price_by_location', {
      p_item_id: itemId,
      p_location: location,
      p_price_data: priceData,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(
      `[SUPABASE CACHE BY LOCATION] Error caching ${itemId}@${location}:`,
      error
    );
    return false;
  }
};

/**
 * Bulk upsert helper. Writes happen sequentially to avoid hitting
 * Supabase RPC rate limits; failures on individual rows are logged
 * but do not throw.
 *
 * @param {Array<{itemId: string, location: string, priceData: object}>} entries
 */
export const setCachedMarketPricesByLocation = async (entries) => {
  for (const entry of entries) {
    await setCachedMarketPriceByLocation(entry.itemId, entry.location, entry.priceData);
  }
};

/**
 * Remove expired cache rows.
 *
 * @returns {Promise<number>} Number of rows removed
 */
export const clearExpiredMarketCacheByLocation = async () => {
  try {
    const { data, error } = await supabase.rpc('clear_expired_market_cache_by_location');
    if (error) throw error;
    console.log(`[SUPABASE CACHE BY LOCATION] Cleared ${data} expired rows`);
    return data;
  } catch (error) {
    console.error('[SUPABASE CACHE BY LOCATION] Error clearing expired cache:', error);
    return 0;
  }
};

/**
 * Check whether a cached row is still valid (used when deciding
 * whether to issue a fresh API call).
 *
 * @param {string} expiresAt - ISO timestamp
 * @returns {boolean}
 */
export const isCacheValid = (expiresAt) => {
  if (!expiresAt) return false;
  const expiresTime = new Date(expiresAt).getTime();
  return Number.isFinite(expiresTime) && expiresTime > Date.now();
};

export { CACHE_TTL };