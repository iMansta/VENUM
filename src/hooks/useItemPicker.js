import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * useItemPicker - hook de lazy loading para o seletor de itens.
 *
 * Em vez de carregar os ~845 itens todos de uma vez, busca APENOS os
 * itens que o usuário precisa ao clicar num slot:
 *   - Filtro: tier=8 + enchantment=0 + (family IN [...])
 *   - Cache em memória (Map) para não refazer a mesma consulta.
 *
 * Retorna:
 *   { items, loading, error, refresh }
 */

// Mapeamento: slot do build → famílias aceitas no banco market_items.
// A coluna `family` em market_items guarda MAIN_AXE, MAIN_SWORD, etc.
// (não o nome do slot). Aqui convertemos slot → lista de famílias.
export const SLOT_TO_FAMILIES = {
  MAIN_HAND: ['MAIN_AXE', 'MAIN_SWORD', 'MAIN_MACE', 'MAIN_DAGGER',
              'MAIN_QUARTERSTAFF', 'MAIN_HAMMER', 'MAIN_SPEAR',
              'MAIN_BOW', 'MAIN_CROSSBOW', 'MAIN_FIRESTAFF',
              'MAIN_FROSTSTAFF', 'MAIN_HOLYSTAFF', 'MAIN_NATURESTAFF',
              'MAIN_ARCANESTAFF', 'MAIN_DEMONICSTAFF', 'MAIN_CURSEDSTAFF'],
  OFF_HAND:  ['OFF_AXE', 'OFF_DAGGER', 'OFF_HOLY', 'OFF_NATURE',
              'OFF_ARCANESTAFF', 'OFF_DEMONICSTAFF', 'OFF_FIRESTAFF',
              'OFF_FROSTSTAFF', 'OFF_CROSSBOW', 'OFF_TORCH', 'OFF_SHIELD',
              'OFF_BOOK', 'OFF_ORB', 'OFF_TOTEM', 'OFF_HORN', 'SHIELD'],
  HEAD:      ['HEAD_PLATE', 'HEAD_CLOTH', 'HEAD_LEATHER'],
  ARMOR:     ['ARMOR_PLATE', 'ARMOR_CLOTH', 'ARMOR_LEATHER'],
  SHOES:     ['SHOES_PLATE', 'SHOES_CLOTH', 'SHOES_LEATHER'],
  CAPE:      ['CAPE'],
  BAG:       ['BAG'],
  FOOD:      [],  // FOOD_T8 é gerado a partir de MARKET_ITEMS (sem família)
  POTION:    [],
  MOUNT:     [],
};

const cache = new Map();

export const useItemPicker = (slotKey = null, tier = 8) => {
  const families = slotKey ? (SLOT_TO_FAMILIES[slotKey] || []) : null;
  const cacheKey = `${tier}::${slotKey || 'ALL'}::${(families || []).join(',')}`;
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
        // 1) Tenta via VIEW primeiro
        let query = supabase
          .from('v_market_items_base_only')
          .select('item_id, tier, enchantment, family, category, name_pt')
          .eq('tier', tier)
          .eq('enchantment', 0)
          .limit(150);

        if (families && families.length > 0) {
          query = query.in('family', families);
        } else if (families && families.length === 0 && slotKey) {
          // Slot sem família conhecida (FOOD/POTION/MOUNT) — não busca nada
          // no banco, retorna array vazio.
          cache.set(cacheKey, []);
          setItems([]);
          return;
        }

        let { data, error } = await query;

        // 2) Fallback via RPC se a view não existir
        if (error && (error.code === '42P01' || /does not exist/i.test(error.message || ''))) {
          console.warn('[useItemPicker] view v_market_items_base_only missing, using RPC fallback');
          const rpc = await supabase.rpc('get_market_items_catalog', {
            p_tier: tier,
            p_family: null, // a RPC atual não aceita array, então busca todas
            p_base_only: true,
            p_limit: 200,
          });
          data = rpc.data;
          error = rpc.error;

          // Aplica filtro client-side por família se necessário
          if (!error && families && families.length > 0 && Array.isArray(data)) {
            data = data.filter((it) => families.includes(it.family));
          }
        }

        if (error) throw error;

        const list = Array.isArray(data) ? data : [];

        // 3) Diagnóstico: log de quantos itens foram encontrados
        console.log(
          `[useItemPicker] slot=${slotKey} tier=${tier} ` +
          `families=[${(families || []).join(',')}] ` +
          `→ ${list.length} item(s) encontrado(s)`
        );

        cache.set(cacheKey, list);
        setItems(list);
      } catch (e) {
        console.warn('[useItemPicker] failed:', e?.message);
        setError(e);
        setItems([]);
      } finally {
        setLoading(false);
        inflight.current = false;
      }
    })();
  }, [cacheKey, slotKey, tier, families]);

  const refresh = async () => {
    cache.delete(cacheKey);
    setItems([]);
    setLoading(true);
  };

  return { items, loading, error, refresh };
};

export const clearItemPickerCache = () => cache.clear();

export default useItemPicker;