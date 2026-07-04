import { useState, useEffect, useCallback } from 'react';
import { fetchTopOpportunities, COMMON_ITEMS } from '@/lib/albion/api';

/**
 * Custom hook to fetch and manage market opportunities.
 *
 * Behaviour:
 *   - Always fetches ALL tiers (T4 → T8). The legacy "Carregar T6-T8"
 *     toggle has been removed from the UI, so the initial payload
 *     includes every equipment tier.
 *   - Profit / margin thresholds come from `market_settings` (Supabase)
 *     with the documented defaults:
 *       - minProfit = 10000
 *       - minMarginPct = 0.10 (10%)
 *   - Consumers receive the same `opportunities` shape regardless of
 *     tier scope.
 *
 * @param {number} limit - Number of opportunities to fetch (default: 50)
 * @param {number} refreshKey - Key to trigger refresh
 * @returns {Object} Opportunities data and loading state
 */
export const useMarketOpportunities = (limit = 50, refreshKey = 0) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, phase: 'idle' });

  const loadOpportunities = useCallback(async ({ forceRefresh = false } = {}) => {
    setLoading(true);
    setError(null);
    setProgress({ loaded: 0, total: 0, phase: 'cache' });

    try {
      const data = await fetchTopOpportunities(COMMON_ITEMS, limit, false, {
        includeAllTiers: true, // always fetch T4-T8 (UI toggle removed)
        onProgress: setProgress,
        forceRefresh,
      });

      setOpportunities(data);
    } catch (err) {
      setError('Failed to load opportunities');
      console.error('Error loading opportunities:', err);
    } finally {
      setLoading(false);
      setProgress(prev => ({ ...prev, phase: 'complete' }));
    }
  }, [limit]);

  useEffect(() => {
    loadOpportunities({ forceRefresh: false });
  }, [refreshKey, loadOpportunities]);

  return {
    opportunities,
    loading,
    error,
    refresh: () => loadOpportunities({ forceRefresh: true }),
    progress,
  };
};