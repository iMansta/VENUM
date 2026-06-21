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
