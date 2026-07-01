import { supabase } from './client';

/**
 * Busca IDs do catálogo centralizado para arbitragem (só preços na API).
 * Fallback: lista estática local se RPC/tabela não existir.
 */
export const getArbitrageCatalogItemIds = async (options = {}) => {
  const { minTier = 4, maxTier = 8, limit = 500 } = options;

  try {
    const { data, error } = await supabase.rpc('get_arbitrage_catalog_item_ids', {
      p_min_tier: minTier,
      p_max_tier: maxTier,
      p_limit: limit,
    });

    if (error) throw error;

    const ids = (data || []).map((row) => row.item_id || row).filter(Boolean);
    if (ids.length > 0) {
      console.log(`[CATALOG] ${ids.length} itens do catálogo Supabase`);
      return ids;
    }
  } catch (error) {
    console.warn('[CATALOG] RPC indisponível, usando fallback local:', error?.message);
  }

  try {
    const { data, error } = await supabase
      .from('market_items')
      .select('item_id')
      .gte('tier', minTier)
      .lte('tier', maxTier)
      .limit(limit);

    if (!error && data?.length) {
      return data.map((r) => r.item_id);
    }
  } catch {
    /* ignore */
  }

  const { MARKET_ITEMS } = await import('@/constants/marketItems');
  return MARKET_ITEMS;
};

export default getArbitrageCatalogItemIds;
