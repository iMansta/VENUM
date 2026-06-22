import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * useItemPicker - hook de lazy loading para o seletor de itens.
 *
 * Em vez de carregar os ~845 itens todos de uma vez, busca APENAS os
 * itens que o usuário precisa ao clicar num slot:
 *   - Filtro: tier=8 + enchantment=0 + family (slot específico)
 *   - Cache em memória (Map) para não refazer a mesma consulta.
 *
 * Retorna:
 *   { items, loading, error, refresh }
 */
const cache = new Map(); // cache global compartilhado entre instâncias

export const useItemPicker = (tier = 8, family = null) => {
  const cacheKey = `${tier}::${family || 'ALL'}`;
  const [items, setItems] = useState(() => cache.get(cacheKey) || []);
  const [loading, setLoading] = useState(!cache.has(cacheKey));
  const [error, setError] = useState(null);
  const inflight = useRef(false);

  useEffect(() => {
    if (cache.has(cacheKey) || inflight.current) return;

    inflight.current = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Query direta na view `v_market_items_base_only` (filtra enc=0 no SQL).
        // Se a view/tabela não existir, faz fallback para a RPC.
        let query = supabase
          .from('v_market_items_base_only')
          .select('item_id, tier, enchantment, family, category, name_pt')
          .eq('tier', tier)
          .eq('enchantment', 0)
          .limit(120);

        if (family) {
          query = query.eq('family', family);
        }

        let { data, error } = await query;

        // Fallback via RPC se a view não existir (migration não aplicada)
        if (error && (error.code === '42P01' || /does not exist/i.test(error.message || ''))) {
          const rpc = await supabase.rpc('get_market_items_catalog', {
            p_tier: tier,
            p_family: family,
            p_base_only: true,
            p_limit: 120,
          });
          data = rpc.data;
          error = rpc.error;
        }

        if (error) throw error;

        const list = Array.isArray(data) ? data : [];
        cache.set(cacheKey, list);
        setItems(list);
      } catch (e) {
        console.warn('[useItemPicker] failed, using empty list:', e?.message);
        setError(e);
        setItems([]);
      } finally {
        setLoading(false);
        inflight.current = false;
      }
    })();
  }, [cacheKey, family, tier]);

  const refresh = async () => {
    cache.delete(cacheKey);
    setItems([]);
    setLoading(true);
  };

  return { items, loading, error, refresh };
};

export const clearItemPickerCache = () => cache.clear();

export default useItemPicker;