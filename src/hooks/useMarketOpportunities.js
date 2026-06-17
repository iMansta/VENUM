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

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchTopOpportunities(COMMON_ITEMS, limit);
      setOpportunities(data);
    } catch (err) {
      setError('Failed to load opportunities');
      console.error('Error loading opportunities:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadOpportunities();
  }, [refreshKey, loadOpportunities]);

  return {
    opportunities,
    loading,
    error,
    refresh: loadOpportunities,
  };
};
