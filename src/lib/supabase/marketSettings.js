import { supabase } from './client';

/**
 * Market Settings Service
 *
 * Fetches the dynamic configuration used by the arbitrage pipeline:
 *   - MIN_PROFIT      : minimum net profit in silver
 *   - MIN_MARGIN_PCT  : minimum margin (as fraction, e.g. 0.10 = 10%)
 *
 * Values are read from the single-row `public.market_settings` table.
 * If the table/row is missing or the request fails, sensible defaults
 * are returned so the app keeps working offline / on a fresh DB.
 */

const DEFAULT_SETTINGS = Object.freeze({
  minProfit: 10000,
  minMarginPct: 0.10,
});

let cachedSettings = null;
let cacheTimestamp = 0;
const SETTINGS_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get current market settings, with safe defaults.
 * @returns {Promise<{minProfit: number, minMarginPct: number}>}
 */
export const getMarketSettings = async () => {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabase.rpc('get_market_settings');

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      console.warn('[MARKET SETTINGS] Empty response, using defaults');
      cachedSettings = { ...DEFAULT_SETTINGS };
    } else {
      const minProfit = Number(row.min_profit);
      const minMarginPct = Number(row.min_margin_pct);
      cachedSettings = {
        minProfit: Number.isFinite(minProfit) ? minProfit : DEFAULT_SETTINGS.minProfit,
        minMarginPct: Number.isFinite(minMarginPct) ? minMarginPct : DEFAULT_SETTINGS.minMarginPct,
      };
    }
  } catch (err) {
    console.warn('[MARKET SETTINGS] Failed to load settings, using defaults:', err?.message || err);
    cachedSettings = { ...DEFAULT_SETTINGS };
  }

  cacheTimestamp = now;
  console.log(
    `[MARKET SETTINGS] minProfit=${cachedSettings.minProfit}, minMarginPct=${cachedSettings.minMarginPct}`
  );
  return cachedSettings;
};

/**
 * Invalidate the in-memory settings cache (used by admin tooling if needed).
 */
export const invalidateMarketSettingsCache = () => {
  cachedSettings = null;
  cacheTimestamp = 0;
};