import { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import ItemSlot from './ItemSlot';
import {
  ITEM_SLOTS,
  SLOT_LABELS_PT,
  FAMILY_TO_SLOT,
  getItemDefinition,
} from '@/constants/itemDefinitions';
import { translateItem, parseItemId } from '@/utils/itemTranslator';
import { supabase } from '@/lib/supabase/client';

// =============================================================================
// Normalização: o grid sempre mostra os 10 slots oficiais na ordem:
// MAIN_HAND, OFF_HAND, HEAD, ARMOR, SHOES, CAPE, BAG, FOOD, POTION, MOUNT.
// =============================================================================

/**
 * BuildBuilder - Construtor visual de builds do Albian Online.
 *
 * Refatoração (Tarefa 13):
 *   - Slots padronizados (ITEM_SLOTS) e sempre visíveis (incluindo
 *     FOOD, POTION, MOUNT).
 *   - Itens são carregados via useItemPicker (lazy load por family)
 *     em vez de ter 845 itens no bundle.
 *   - Skills/passivas vêm de itemDefinitions (lookup local).
 *   - Campos de habilidade SÓ aparecem quando o item tem skills.
 */
const TIER_DEFAULT = 8;

const BuildBuilder = ({ value, onChange, readOnly = false }) => {
  const initialItems = useMemo(() => {
    const raw = value?.items || value || {};
    const normalized = {};
    Object.entries(raw).forEach(([slot, val]) => {
      if (!val) return;
      if (typeof val === 'string') {
        normalized[slot] = { item_id: val, skills: {} };
      } else if (typeof val === 'object') {
        normalized[slot] = {
          item_id: val.item_id || val.id || null,
          skills: val.skills || val.habilidades || {},
        };
      }
    });
    return normalized;
  }, [value]);

  const [items, setItems] = useState(initialItems);
  const [openSlot, setOpenSlot] = useState(null); // chave do slot aberto

  const emitChange = (newItems) => {
    setItems(newItems);
    if (onChange) onChange({ version: 2, items: newItems });
  };

  const setSlotItem = (slotKey, itemId) => {
    const newItems = {
      ...items,
      [slotKey]: { item_id: itemId, skills: items[slotKey]?.skills || {} },
    };
    emitChange(newItems);
  };

  const clearSlot = (slotKey) => {
    const newItems = { ...items };
    delete newItems[slotKey];
    emitChange(newItems);
    if (openSlot === slotKey) setOpenSlot(null);
  };

  const setSlotSkill = (slotKey, abilityKey, value) => {
    const slot = items[slotKey];
    if (!slot) return;
    const newSkills = { ...slot.skills, [abilityKey]: value };
    const newItems = { ...items, [slotKey]: { ...slot, skills: newSkills } };
    emitChange(newItems);
  };

  const handleSlotClick = (slotKey) => {
    if (readOnly) return;
    setOpenSlot((cur) => (cur === slotKey ? null : slotKey));
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Slots do personagem (Albian Online)
        </h3>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 p-4 bg-zinc-900/60 rounded-lg border border-zinc-800">
          {ITEM_SLOTS.map((slotKey) => (
            <ItemSlot
              key={slotKey}
              slotKey={slotKey}
              slotLabel={SLOT_LABELS_PT[slotKey]}
              iconPrefix={slotKey}
              itemId={items[slotKey]?.item_id || null}
              size={56}
              editable={!readOnly}
              selected={openSlot === slotKey}
              onClick={() => handleSlotClick(slotKey)}
              onRemove={() => clearSlot(slotKey)}
            />
          ))}
        </div>
      </div>

      {!readOnly && openSlot && (
        <ItemPickerLazy
          slotKey={openSlot}
          slotLabel={SLOT_LABELS_PT[openSlot]}
          currentItemId={items[openSlot]?.item_id || null}
          onPick={(itemId) => setSlotItem(openSlot, itemId)}
          onClose={() => setOpenSlot(null)}
        />
      )}

      {!readOnly && openSlot && items[openSlot]?.item_id && (
        <SkillSelectorDynamic
          itemId={items[openSlot].item_id}
          skills={items[openSlot]?.skills || {}}
          onChange={(abilityKey, value) => setSlotSkill(openSlot, abilityKey, value)}
        />
      )}

      <details className="text-xs text-zinc-500">
        <summary className="cursor-pointer hover:text-zinc-300 select-none">
          Ver JSON estruturado ({Object.keys(items).length} slots preenchidos)
        </summary>
        <pre className="mt-2 p-3 bg-zinc-950 border border-zinc-800 rounded text-[11px] overflow-x-auto">
{JSON.stringify({ version: 2, items }, null, 2)}
        </pre>
      </details>
    </div>
  );
};

// =============================================================================
// ItemPickerLazy - popover com lazy load via Supabase
// =============================================================================
const ItemPickerLazy = ({ slotKey, slotLabel, currentItemId, onPick, onClose }) => {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let data;
        let rpcErr;

        // Tenta via view primeiro
        let res = await supabase
          .from('v_market_items_base_only')
          .select('item_id, tier, enchantment, family, category, name_pt')
          .eq('tier', TIER_DEFAULT)
          .eq('enchantment', 0)
          .limit(120);

        if (res.error && /does not exist/i.test(res.error.message || '')) {
          // Fallback via RPC
          const rpc = await supabase.rpc('get_market_items_catalog', {
            p_tier: TIER_DEFAULT,
            p_family: slotKey,
            p_base_only: true,
            p_limit: 120,
          });
          data = rpc.data;
          rpcErr = rpc.error;
          if (rpcErr) throw rpcErr;
        } else if (res.error) {
          throw res.error;
        } else {
          data = res.data;
        }

        if (cancelled) return;
        // Filtrar pela slot usando FAMILY_TO_SLOT
        const filtered = (Array.isArray(data) ? data : []).filter((it) => {
          if (slotKey === 'MAIN_HAND') return it.item_id.includes('MAIN_');
          if (slotKey === 'OFF_HAND')  return it.item_id.includes('OFF_') || it.item_id.includes('SHIELD');
          if (slotKey === 'HEAD')      return it.item_id.includes('HEAD_');
          if (slotKey === 'ARMOR')     return it.item_id.includes('ARMOR_');
          if (slotKey === 'SHOES')     return it.item_id.includes('SHOES_');
          if (slotKey === 'CAPE')      return it.item_id === 'T8_CAPE';
          if (slotKey === 'BAG')       return it.item_id === 'T8_BAG';
          if (slotKey === 'FOOD')      return it.item_id.startsWith('T8_FOOD');
          if (slotKey === 'POTION')    return it.item_id.startsWith('T8_POTION');
          if (slotKey === 'MOUNT')     return it.item_id.startsWith('T8_MOUNT');
          return true;
        });

        setItems(filtered);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slotKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.item_id.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="border border-amber-500/40 bg-zinc-950 rounded-lg overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <Search className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar ${slotLabel} — Tier ${TIER_DEFAULT} do Albian Online...`}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 p-1 rounded"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto p-2">
        {loading ? (
          <p className="text-xs text-zinc-500 text-center py-6 animate-pulse">
            Carregando itens do Albian Online...
          </p>
        ) : error ? (
          <p className="text-xs text-red-400 text-center py-6">
            Erro ao carregar. Verifique se a migration foi aplicada.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">
            Nenhum item encontrado para este slot.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {filtered.map((it) => (
              <ItemPickerCard
                key={it.item_id}
                itemId={it.item_id}
                selected={it.item_id === currentItemId}
                onPick={() => {
                  onPick(it.item_id);
                  onClose();
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-500 flex items-center justify-between">
        <span>{filtered.length} itens · Tier {TIER_DEFAULT} · sem encantamentos</span>
        <kbd className="px-1 bg-zinc-800 rounded">Esc fecha</kbd>
      </div>
    </div>
  );
};

const ItemPickerCard = ({ itemId, onPick, selected = false }) => (
  <button
    type="button"
    onClick={onPick}
    title={itemId}
    className={[
      'flex flex-col items-center gap-1 p-2 rounded border transition-all group',
      selected
        ? 'border-amber-500 bg-amber-500/10'
        : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-amber-500/50',
    ].join(' ')}
  >
    <img
      src={`https://render.albiononline.com/v1/item/${encodeURIComponent(itemId)}.png`}
      alt={itemId}
      loading="lazy"
      onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}
      className="w-12 h-12 object-contain"
    />
    <span className="text-[10px] text-zinc-300 text-center line-clamp-1 w-full">
      {translateItem(itemId, { includeTier: false })}
    </span>
    <span className="text-[9px] text-zinc-500 font-mono">
      {parseItemId(itemId).tier ? `T${parseItemId(itemId).tier}` : ''}
    </span>
  </button>
);

// =============================================================================
// SkillSelectorDynamic - lê skills/passivas do itemDefinitions
// =============================================================================
const COMMON_PASSIVES = [
  'HP Máximo',
  'Regeneração de Vida',
  'Regeneração de Mana',
  'Resistência Física',
  'Resistência Mágica',
  'Poder de Ataque',
  'Poder de Defesa',
  'Velocidade de Ataque',
  'Velocidade de Movimento',
  'Evasão',
  'Crítico',
  'Sorte',
  'Honra',
  'Buffar Party',
  'Cura Aliada',
];

const SkillSelectorDynamic = ({ itemId, skills, onChange }) => {
  const def = getItemDefinition(itemId);

  if (!def || (!def.skills || Object.keys(def.skills).length === 0) && (!def.passives || def.passives.length === 0)) {
    return (
      <div className="bg-zinc-900/60 rounded-lg border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <h4 className="text-sm font-semibold text-zinc-200">
            Habilidades & Passivas
          </h4>
        </div>
        <p className="text-xs text-zinc-500">
          Item sem habilidades/passivas catalogadas. Use o campo de táticas na
          descrição da build para recomendar opções.
        </p>
      </div>
    );
  }

  const skillEntries = Object.entries(def.skills || {}).filter(([, arr]) => arr?.length > 0);
  const passiveList = def.passives || [];

  return (
    <div className="bg-zinc-900/60 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <h4 className="text-sm font-semibold text-zinc-200">
          Habilidades & Passivas
        </h4>
        <span className="ml-auto text-[10px] text-zinc-500 font-mono">
          {itemId}
        </span>
      </div>

      {skillEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {skillEntries.map(([key, options]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono mr-2 uppercase">
                  {key}
                </span>
                Habilidade
              </label>
              <select
                value={skills[key.toUpperCase()] || ''}
                onChange={(e) => onChange(key.toUpperCase(), e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">— Selecione —</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {passiveList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-zinc-800 pt-3">
          {passiveList.map((p) => {
            const passiveKey = `passive_${p.split(':')[0].trim()}`;
            return (
              <div key={p}>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono mr-2 uppercase">
                    P
                  </span>
                  {p}
                </label>
                <select
                  value={skills[passiveKey] || ''}
                  onChange={(e) => onChange(passiveKey, e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">— Selecione uma passiva —</option>
                  {COMMON_PASSIVES.map((cp) => (
                    <option key={cp} value={cp}>{cp}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BuildBuilder;