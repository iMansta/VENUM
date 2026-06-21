import { useState, useEffect, useCallback } from 'react';
import { fetchTopOpportunities, COMMON_ITEMS } from '@/lib/albion/api';

/**
 * Custom hook to fetch and manage market opportunities
 * Ensures single source of truth for market data across components
 * @param {number} limit - Number of opportunities to fetch (default: 50)
 * @param {number} refreshKey - Key to trigger refresh
 * @returns {Object} Opportunities data and loading state
 */
export const useMarketOpportunities = (limit = 50, refreshKey = 0) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, phase: 'idle' });
  const [includeAllTiers, setIncludeAllTiers] = useState(false);

  const loadOpportunities = useCallback(async ({
    includeAllTiers: shouldIncludeAllTiers = false,
    forceRefresh = false,
  } = {}) => {
    setLoading(true);
    setError(null);
    setIncludeAllTiers(shouldIncludeAllTiers);
    setProgress({ loaded: 0, total: 0, phase: 'cache' });

    try {
      const data = await fetchTopOpportunities(COMMON_ITEMS, limit, false, {
        includeAllTiers: shouldIncludeAllTiers,
        onProgress: setProgress,
        forceRefresh,
      });

      // TODO[diag]: remove after verifying "0 profitable opportunities" issue
      // eslint-disable-next-line no-console
      console.log(
        '[DIAG][useMarketOpportunities] raw count=', Array.isArray(data) ? data.length : 0,
        'bmCount=',
        Array.isArray(data) ? data.filter(o => (o?.sellCity || 'Black Market') === 'Black Market').length : 0,
        'withNetProfit=',
        Array.isArray(data) ? data.filter(o => Number.isFinite(o?.netProfit) && o.netProfit > 0).length : 0,
        'sample=', Array.isArray(data) ? data[0] : null
      );

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
    loadOpportunities({ includeAllTiers: false, forceRefresh: false });
  }, [refreshKey, loadOpportunities]);

  return {
    opportunities,
    loading,
    error,
    refresh: loadOpportunities,
    progress,
    includeAllTiers,
    hasMoreTiers: !includeAllTiers,
    loadAllTiers: () => loadOpportunities({ includeAllTiers: true, forceRefresh: true }),
  };
};
