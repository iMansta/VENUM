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
 *
 * Resilience contract:
 *   - Missing RPCs (PGRST202 / 404) are handled gracefully. They are
 *     reported ONCE per RPC per session via a `console.warn`, then
 *     silenced so we don't spam the console on every request.
 *   - All other errors are logged but never thrown to the caller.
 *     The arbitrage pipeline must keep running with or without cache.
 */

const CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Track which RPCs are missing so we only warn once per session per RPC.
const missingRpcWarned = new Set();

const isMissingRpcError = (error) => {
  if (!error) return false;
  const code = error.code;
  const status = error.status;
  const msg = String(error.message || '');
  return (
    code === 'PGRST202' ||
    status === 404 ||
    /Could not find the function public\./i.test(msg)
  );
};

const noteMissingRpc = (rpcName, error) => {
  if (missingRpcWarned.has(rpcName)) return;
  missingRpcWarned.add(rpcName);
  console.warn(
    `[SUPABASE CACHE BY LOCATION] RPC '${rpcName}' is missing in Supabase. ` +
      `The arbitrage pipeline will keep working from the Albion API directly. ` +
      `Apply 'supabase/schema_market_refactor.sql' in the Supabase SQL editor to enable caching. ` +
      `(Underlying error: ${error?.message || error})`
  );
};

/**
 * Reset the in-memory "missing RPC" tracker. Useful for tests or after
 * the user confirms they've applied the migration.
 */
export const resetMissingRpcWarnings = () => missingRpcWarned.clear();

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

    if (error) {
      if (isMissingRpcError(error)) {
        noteMissingRpc('get_cached_market_prices_by_location', error);
        return {};
      }
      throw error;
    }

    const grouped = {};
    (data || []).forEach((row) => {
      // Tolerate either snake_case (PostgREST default for our RPC) or
      // camelCase (e.g. when called via a custom server-side transformer).
      const itemId = row.item_id ?? row.itemId;
      const location = row.location ?? row.city;
      const priceData = row.price_data ?? row.priceData;
      const cachedAt = row.cached_at ?? row.cachedAt;
      const expiresAt = row.expires_at ?? row.expiresAt;

      if (!itemId) return; // skip malformed rows
      if (!grouped[itemId]) grouped[itemId] = [];
      grouped[itemId].push({
        location,
        priceData,
        cachedAt,
        expiresAt,
      });
    });

    if (data && data.length > 0) {
      console.log(
        `[SUPABASE CACHE BY LOCATION] Retrieved ${data.length} rows for ${itemIds.length} items`
      );
    }
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

    if (error) {
      if (isMissingRpcError(error)) {
        noteMissingRpc('set_cached_market_price_by_location', error);
        return false;
      }
      throw error;
    }
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
  if (!entries || entries.length === 0) return;
  let successCount = 0;
  for (const entry of entries) {
    const ok = await setCachedMarketPriceByLocation(entry.itemId, entry.location, entry.priceData);
    if (ok) successCount++;
  }
  if (successCount > 0 && !missingRpcWarned.has('set_cached_market_price_by_location')) {
    console.log(
      `[SUPABASE CACHE BY LOCATION] Persisted ${successCount}/${entries.length} (item, location) rows`
    );
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
    if (error) {
      if (isMissingRpcError(error)) {
        noteMissingRpc('clear_expired_market_cache_by_location', error);
        return 0;
      }
      throw error;
    }
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