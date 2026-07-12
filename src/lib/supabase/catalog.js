import { supabase } from './client';
import { getLocalItemsForSlot } from '@/lib/albion/slotItems';
import { translateItem, cleanItemName } from '@/utils/itemTranslator';
import { getAlbionIconUrl, normalizeAlbionAssetUrl } from '@/utils/albionIcon';

/**
 * Busca itens para um slot do build picker.
 * Ordem: RPC Supabase → tabela market_items → catálogo local.
 */
export const getItemsForSlot = async ({
  slotKey,
  tier = null,
  search = '',
  limit = 50,
  offset = 0,
}) => {
  const mapRow = (row) => ({
    item_id: row.item_id,
    name_pt: cleanItemName(row.name_pt, row.item_id) || translateItem(row.item_id, { includeTier: true }),
    tier: row.tier ?? tier,
    family: row.family,
    image_url: normalizeAlbionAssetUrl(row.image_url, getAlbionIconUrl(row.item_id)),
  });

  // 1) RPC Supabase (fonte canônica)
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
      p_tier: tier ?? 8,
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

  // 3) Tabela market_items (fallback canônico)
  try {
    let query = supabase
      .from('market_items')
      .select('item_id, name_pt, tier, family, slot, image_url')
      .eq('enchantment', 0)
      .order('tier', { ascending: false })
      .limit(limit);

    if (Number.isInteger(tier)) {
      query = query.eq('tier', tier);
    }

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

  // 4) Catálogo local (último fallback para não quebrar UI)
  const local = getLocalItemsForSlot(slotKey, tier, search);
  if (local.length > 0) {
    return {
      items: local.slice(offset, offset + limit),
      source: 'local',
    };
  }

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

export const getCatalogItemsMeta = async (itemIds = []) => {
  const ids = Array.from(new Set((itemIds || []).filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('market_items')
    .select('item_id, name_pt, image_url, category, subcategory, slot')
    .in('item_id', ids);

  if (error) {
    console.warn('[CATALOG] getCatalogItemsMeta failed:', error.message);
    return {};
  }

  return (data || []).reduce((acc, row) => {
    acc[row.item_id] = {
      ...row,
      image_url: normalizeAlbionAssetUrl(row.image_url, getAlbionIconUrl(row.item_id)),
    };
    return acc;
  }, {});
};

export const SHOP_CATALOG_GROUPS = {
  all: { label: 'Todos', slots: [] },
  mounts: { label: 'Montarias', slots: ['MOUNT'] },
  consumables: { label: 'Consumíveis', slots: ['FOOD', 'POTION'] },
  weapons: { label: 'Armas', slots: ['MAIN_HAND', 'OFF_HAND'] },
  head: { label: 'Cabeça', slots: ['HEAD'] },
  chest: { label: 'Peito', slots: ['ARMOR'] },
  shoes: { label: 'Calçados', slots: ['SHOES'] },
  cape: { label: 'Capa', slots: ['CAPE'] },
  bag: { label: 'Bolsa', slots: ['BAG'] },
};

const SHOP_CATEGORY_BY_GROUP = {
  mounts: 'montarias',
  consumables: 'consumiveis',
  weapons: 'armas',
  head: 'cabeca',
  chest: 'peito',
  shoes: 'calcados',
  cape: 'capa',
  bag: 'bolsa',
  all: 'geral',
};

export const mapShopCategoryFromGroup = (groupKey) =>
  SHOP_CATEGORY_BY_GROUP[groupKey] || 'geral';

export const searchCatalogItemsForShop = async ({
  group = 'all',
  search = '',
  limit = 60,
  offset = 0,
} = {}) => {
  const cfg = SHOP_CATALOG_GROUPS[group] || SHOP_CATALOG_GROUPS.all;

  let query = supabase
    .from('market_items')
    .select('item_id, name_pt, image_url, slot, category, subcategory, tier, enchantment')
    .eq('enchantment', 0)
    .order('tier', { ascending: false })
    .order('name_pt', { ascending: true })
    .range(offset, offset + Math.max(limit - 1, 0));

  if (cfg.slots.length > 0) {
    query = query.in('slot', cfg.slots);
  }

  const q = String(search || '').trim();
  if (q) {
    query = query.or(`name_pt.ilike.%${q}%,item_id.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    item_id: row.item_id,
    name_pt: cleanItemName(row.name_pt, row.item_id) || translateItem(row.item_id, { includeTier: true }),
    image_url: normalizeAlbionAssetUrl(row.image_url, getAlbionIconUrl(row.item_id)),
    slot: row.slot,
    category: row.category,
    subcategory: row.subcategory,
    tier: row.tier,
  }));
};

/**
 * Busca item com skills/passivas do catálogo.
 * Se não existir template no banco, tenta aquecer via API interna e lê de novo.
 */
export const getItemWithSkills = async (itemId) => {
  if (!itemId) return null;

  const readFromRpc = async () => {
    const { data, error } = await supabase.rpc('get_item_with_skills', {
      p_item_id: itemId,
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0];
  };

  // Detecta dados legados/placeholder: skills sem icon_url oficial.
  const looksFake = (row) => {
    const all = [
      ...(Array.isArray(row?.active_skills) ? row.active_skills : []),
      ...(Array.isArray(row?.passive_skills) ? row.passive_skills : []),
    ];
    if (all.length === 0) return false;
    return all.some((s) => !s || !s.icon_url);
  };

  try {
    const row = await readFromRpc();
    // Só considera processado quando há pelo menos uma skill/passiva real.
    // Arrays vazios devem acionar o aquecimento do template.
    const hasArrays =
      Array.isArray(row?.active_skills) && Array.isArray(row?.passive_skills);
    const skillCount =
      (Array.isArray(row?.active_skills) ? row.active_skills.length : 0) +
      (Array.isArray(row?.passive_skills) ? row.passive_skills.length : 0);
    if (row && hasArrays && skillCount > 0 && !looksFake(row)) {
      return row;
    }
  } catch {
    // segue para tentativa de aquecimento
  }

  try {
    await fetch(`/api/catalog-skill-template?itemId=${encodeURIComponent(itemId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // ignore: manter fallback local no builder
  }

  try {
    return await readFromRpc();
  } catch {
    return null;
  }
};

export default getArbitrageCatalogItemIds;
