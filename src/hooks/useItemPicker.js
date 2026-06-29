import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * useItemPicker - hook de lazy loading paginado para o seletor de itens.
 *
 * Refatoração (Single Source of Truth):
 *   - Usa RPC get_items_for_slot do Supabase com paginação (50 itens)
 *   - Cache em memória (Map) para não refazer a mesma consulta
 *   - Suporta busca textual via parâmetro p_search
 *   - Carrega mais itens sob demanda (offset)
 *
 * Retorna:
 *   { items, loading, error, refresh, loadMore, hasMore }
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

  const cacheKey = `${tier}::${slotKey || 'ALL'}::${search}::${offset}`;

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
      const { data, error } = await supabase.rpc('get_items_for_slot', {
        p_slot: slotKey,
        p_tier: tier,
        p_search: search || null,
        p_limit: limit,
        p_offset: currentOffset,
      });

      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      setHasMore(list.length === limit);

      if (reset) {
        setItems(list);
        setOffset(limit);
      } else {
        setItems(prev => [...prev, ...list]);
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