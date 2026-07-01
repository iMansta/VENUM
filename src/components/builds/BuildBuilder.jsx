import { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import ItemSlot from './ItemSlot';
import { ITEM_SLOTS, SLOT_LABELS_PT } from '@/constants/itemDefinitions';
import { translateItem, parseItemId } from '@/utils/itemTranslator';
import { getItemsForSlot } from '@/lib/supabase/catalog';

// =============================================================================
// Normalização: o grid sempre mostra os 10 slots oficiais na ordem:
// MAIN_HAND, OFF_HAND, HEAD, ARMOR, SHOES, CAPE, BAG, FOOD, POTION, MOUNT.
// =============================================================================

/**
 * BuildBuilder - Construtor visual de builds do Albion Online.
 *
 * Refatoração (Single Source of Truth):
 *   - Slots padronizados (ITEM_SLOTS) e sempre visíveis (incluindo
 *     FOOD, POTION, MOUNT).
 *   - Itens são carregados via RPC get_items_for_slot (lazy load por slot)
 *   - Skills/passivas vêm de RPC get_item_with_skills (Supabase)
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
          Slots do personagem (Albion Online)
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
    </div>
  );
};

// =============================================================================
// ItemPickerLazy - popover com lazy load via RPC get_items_for_slot
// =============================================================================
const ItemPickerLazy = ({ slotKey, slotLabel, currentItemId, onPick, onClose }) => {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  const loadItems = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    setLoading(true);
    setError(null);

    try {
      const { items: list } = await getItemsForSlot({
        slotKey,
        tier: TIER_DEFAULT,
        search: search || '',
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
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(true);
  }, [slotKey]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadItems(true);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => 
      it.item_id.toLowerCase().includes(q) || 
      (it.name_pt && it.name_pt.toLowerCase().includes(q))
    );
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
          placeholder={`Buscar ${slotLabel} — Tier ${TIER_DEFAULT} do Albion Online...`}
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
            Carregando itens do Albion Online...
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
          <>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {filtered.map((it) => (
                <ItemPickerCard
                  key={it.item_id}
                  item={it}
                  selected={it.item_id === currentItemId}
                  onPick={() => {
                    onPick(it.item_id);
                    onClose();
                  }}
                />
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                onClick={() => loadItems(false)}
                className="w-full mt-2 text-xs text-amber-400 hover:text-amber-300 py-1"
              >
                Carregar mais itens...
              </button>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-500 flex items-center justify-between">
        <span>{filtered.length} itens · Tier {TIER_DEFAULT} · sem encantamentos</span>
        <kbd className="px-1 bg-zinc-800 rounded">Esc fecha</kbd>
      </div>
    </div>
  );
};

const ItemPickerCard = ({ item, onPick, selected = false }) => (
  <button
    type="button"
    onClick={onPick}
    title={item.item_id}
    className={[
      'flex flex-col items-center gap-1 p-2 rounded border transition-all group',
      selected
        ? 'border-amber-500 bg-amber-500/10'
        : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-amber-500/50',
    ].join(' ')}
  >
    <img
      src={item.image_url || `https://render.albiononline.com/v1/item/${encodeURIComponent(item.item_id)}.png`}
      alt={item.item_id}
      loading="lazy"
      onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}
      className="w-12 h-12 object-contain"
    />
    <span className="text-[10px] text-zinc-300 text-center line-clamp-1 w-full">
      {item.name_pt || translateItem(item.item_id, { includeTier: false })}
    </span>
    <span className="text-[9px] text-zinc-500 font-mono">
      T{item.tier}
    </span>
  </button>
);

// =============================================================================
// SkillSelectorDynamic - lê skills/passivas via RPC get_item_with_skills
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
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!itemId) return;

    const loadItemSkills = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase.rpc('get_item_with_skills', {
          p_item_id: itemId,
        });

        if (error) throw error;

        if (data && data.length > 0) {
          setItemData(data[0]);
        } else {
          setItemData(null);
        }
      } catch (e) {
        console.warn('[SkillSelectorDynamic] failed:', e?.message);
        setError(e);
      } finally {
        setLoading(false);
      }
    };

    loadItemSkills();
  }, [itemId]);

  if (loading) {
    return (
      <div className="bg-zinc-900/60 rounded-lg border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <h4 className="text-sm font-semibold text-zinc-200">
            Habilidades & Passivas
          </h4>
        </div>
        <p className="text-xs text-zinc-500 animate-pulse">
          Carregando habilidades do item...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/60 rounded-lg border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <h4 className="text-sm font-semibold text-zinc-200">
            Habilidades & Passivas
          </h4>
        </div>
        <p className="text-xs text-red-400">
          Erro ao carregar habilidades. Use o campo de táticas na descrição.
        </p>
      </div>
    );
  }

  if (!itemData || (!itemData.active_skills || itemData.active_skills.length === 0) && (!itemData.passive_skills || itemData.passive_skills.length === 0)) {
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

  const activeSkills = itemData.active_skills || [];
  const passiveSkills = itemData.passive_skills || [];

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

      {activeSkills.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {activeSkills.map((skill) => (
            <div key={skill.key}>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono mr-2 uppercase">
                  {skill.key}
                </span>
                {skill.name_pt}
              </label>
              <select
                value={skills[skill.key.toUpperCase()] || ''}
                onChange={(e) => onChange(skill.key.toUpperCase(), e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">— Selecione —</option>
                <option value={skill.name_pt}>{skill.name_pt}</option>
              </select>
              {skill.description_pt && (
                <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">
                  {skill.description_pt}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {passiveSkills.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-zinc-800 pt-3">
          {passiveSkills.map((skill) => {
            const passiveKey = `passive_${skill.key}`;
            return (
              <div key={skill.key}>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono mr-2 uppercase">
                    P
                  </span>
                  {skill.name_pt}
                </label>
                <select
                  value={skills[passiveKey] || ''}
                  onChange={(e) => onChange(passiveKey, e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">— Selecione uma passiva —</option>
                  <option value={skill.name_pt}>{skill.name_pt}</option>
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

