import { supabase } from './client';
import { getLocalItemsForSlot } from '@/lib/albion/slotItems';

/**
 * Busca itens para um slot do build picker.
 * Ordem: RPC Supabase → tabela market_items → catálogo local.
 */
export const getItemsForSlot = async ({
  slotKey,
  tier = 8,
  search = '',
  limit = 50,
  offset = 0,
}) => {
  const mapRow = (row) => ({
    item_id: row.item_id,
    name_pt: row.name_pt || row.item_id,
    tier: row.tier ?? tier,
    family: row.family,
    image_url:
      row.image_url ||
      `https://render.albiononline.com/v1/item/${encodeURIComponent(row.item_id)}.png`,
  });

  // 1) Catálogo local (sempre válido — evita RPC 400 e ícones quebrados)
  const local = getLocalItemsForSlot(slotKey, tier, search);
  if (local.length > 0) {
    return {
      items: local.slice(offset, offset + limit),
      source: 'local',
    };
  }

  // 2) RPC Supabase
  try {
    const { data, error } = await supabase.rpc('get_items_for_slot', {
      p_slot: slotKey,
      p_tier: tier,
      p_search: search || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      return { items: data.map(mapRow), source: 'rpc' };
    }
  } catch {
    /* fallback */
  }

  // 2) RPC legado (p_slot_key)
  try {
    const { data, error } = await supabase.rpc('get_items_for_slot', {
      p_slot_key: slotKey,
      p_tier: tier,
      p_enchantment: 0,
      p_limit: limit,
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      const filtered = applySearch(data.map(mapRow), search);
      return { items: filtered.slice(offset, offset + limit), source: 'rpc_legacy' };
    }
  } catch {
    /* fallback */
  }

  // 3) Tabela market_items
  try {
    let query = supabase
      .from('market_items')
      .select('item_id, name_pt, tier, family, slot, image_url')
      .eq('tier', tier)
      .eq('enchantment', 0)
      .limit(limit);

    if (slotKey) {
      query = query.eq('slot', slotKey);
    }

    const { data, error } = await query;
    if (!error && data?.length) {
      const filtered = applySearch(data.map(mapRow), search);
      if (filtered.length) {
        return { items: filtered.slice(offset, offset + limit), source: 'market_items' };
      }
    }
  } catch {
    /* fallback */
  }

  // 4) Fallback local vazio
  return { items: [], source: 'empty' };
};

const applySearch = (items, search) => {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.item_id?.toLowerCase().includes(q) ||
      it.name_pt?.toLowerCase().includes(q)
  );
};

/**
 * Busca IDs do catálogo centralizado para arbitragem (só preços na API).
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
    if (ids.length > 0) return ids;
  } catch (error) {
    console.warn('[CATALOG] RPC indisponível:', error?.message);
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
