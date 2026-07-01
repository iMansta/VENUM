import { useState, useEffect, useRef } from 'react';
import { getItemsForSlot } from '@/lib/supabase/catalog';

/**
 * useItemPicker - lazy loading paginado para o seletor de itens.
 * Usa getItemsForSlot (RPC → market_items → catálogo local).
 */

const cache = new Map();

export const useItemPicker = (slotKey = null, tier = 8, search = '') => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const inflight = useRef(false);
  const limit = 50;

  const loadItems = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    const currentCacheKey = `${tier}::${slotKey || 'ALL'}::${search}::${currentOffset}`;

    if (cache.has(currentCacheKey) && !reset) {
      setItems(cache.get(currentCacheKey));
      return;
    }

    if (inflight.current) return;

    inflight.current = true;
    setLoading(true);
    setError(null);

    try {
      const { items: list } = await getItemsForSlot({
        slotKey,
        tier,
        search,
        limit,
        offset: currentOffset,
      });

      setHasMore(list.length === limit);

      if (reset) {
        setItems(list);
        setOffset(limit);
      } else {
        setItems((prev) => [...prev, ...list]);
        setOffset(currentOffset + limit);
      }

      cache.set(currentCacheKey, list);
    } catch (e) {
      console.warn('[useItemPicker] failed:', e?.message);
      setError(e);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  };

  useEffect(() => {
    loadItems(true);
  }, [slotKey, tier, search]);

  const loadMore = () => {
    if (!loading && hasMore) {
      loadItems(false);
    }
  };

  const refresh = () => {
    cache.clear();
    setOffset(0);
    loadItems(true);
  };

  return { items, loading, error, refresh, loadMore, hasMore };
};

export const clearItemPickerCache = () => cache.clear();

export default useItemPicker;
