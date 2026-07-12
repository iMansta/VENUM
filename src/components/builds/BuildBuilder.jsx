import { useState, useMemo, useEffect } from 'react';
import { Search, X, Sparkles, Swords, Shield } from 'lucide-react';
import ItemSlot from './ItemSlot';
import { ITEM_SLOTS, SLOT_LABELS_PT } from '@/constants/itemDefinitions';
import { translateItem, parseItemId } from '@/utils/itemTranslator';
import { getItemsForSlot, getItemWithSkills } from '@/lib/supabase/catalog';
import { slotSupportsSkills } from '@/lib/albion/slotItems';
import ItemIcon from '@/components/market/ItemIcon';
import { getAlbionIconUrl, normalizeAlbionAssetUrl } from '@/utils/albionIcon';

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
const T8_REQUIRED_SLOTS = new Set(['MAIN_HAND', 'OFF_HAND', 'HEAD', 'ARMOR', 'SHOES', 'CAPE']);
const TIER_DEFAULT = 8;
const getTierForSlot = (slotKey) => (T8_REQUIRED_SLOTS.has(slotKey) ? TIER_DEFAULT : null);

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
  const [openSlot, setOpenSlot] = useState(null);
  const [skillSlot, setSkillSlot] = useState(null);

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
    if (slotSupportsSkills(slotKey)) {
      setSkillSlot(slotKey);
    }
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
    if (items[slotKey]?.item_id && slotSupportsSkills(slotKey)) {
      setSkillSlot(slotKey);
    }
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

      {!readOnly && skillSlot && items[skillSlot]?.item_id && slotSupportsSkills(skillSlot) && (
        <SkillSelectorDynamic
          slotLabel={SLOT_LABELS_PT[skillSlot]}
          itemId={items[skillSlot].item_id}
          skills={items[skillSlot]?.skills || {}}
          onChange={(abilityKey, value) => setSlotSkill(skillSlot, abilityKey, value)}
          onClose={() => setSkillSlot(null)}
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
  const slotTier = getTierForSlot(slotKey);

  const loadItems = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    setLoading(true);
    setError(null);

    try {
      const { items: list } = await getItemsForSlot({
        slotKey,
        tier: slotTier,
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
          placeholder={`Buscar ${slotLabel} — ${slotTier ? `Tier ${slotTier}` : 'Tier 4-8'}...`}
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
            Carregando itens do catálogo...
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
        <span>
          {filtered.length} itens · {slotTier ? `Tier ${slotTier}` : 'Tier 4-8'} · sem encantamentos
        </span>
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
    <ItemIcon itemId={item.item_id} imageUrl={item.image_url} size={48} />
    <span className="text-[10px] text-zinc-300 text-center line-clamp-1 w-full">
      {item.name_pt || translateItem(item.item_id, { includeTier: false })}
    </span>
    <span className="text-[9px] text-zinc-500 font-mono">T{item.tier}</span>
  </button>
);

const SkillChoiceButton = ({ skill, selected, onSelect, passive = false }) => {
  const label = skill?.name_pt || skill?.name || skill?.key || 'Skill';
  const description = skill?.description_pt || skill?.description || '';
  const value = label;
  const Icon = passive ? Shield : Swords;
  const [imgError, setImgError] = useState(false);
  const skillIconUrl = normalizeAlbionAssetUrl(skill?.icon_url);
  const showImg = skillIconUrl && !imgError;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        'flex items-center gap-2 rounded border p-1.5 transition-all text-left',
        selected
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-zinc-700 bg-zinc-800 hover:border-amber-500/60 hover:bg-zinc-700',
      ].join(' ')}
      title={description || label}
    >
      {showImg ? (
        <img
          src={skillIconUrl}
          alt={label}
          onError={() => setImgError(true)}
          className="w-9 h-9 flex-shrink-0 rounded object-cover border border-zinc-600 bg-zinc-900"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="w-9 h-9 flex-shrink-0 rounded border border-zinc-600 bg-zinc-900 text-amber-400 inline-flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-zinc-100 leading-tight line-clamp-1">
          {label}
        </div>
        {description ? (
          <div className="text-[10px] text-zinc-500 leading-tight line-clamp-1">{description}</div>
        ) : null}
      </div>
    </button>
  );
};

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

// Editor manual: usado quando o item não tem skills oficiais no catálogo.
// Permite ao officer nomear as habilidades ativas (Q/W/E) e passivas da build,
// exibindo o ícone oficial do próprio item. Honesto e funcional na ausência de
// um mapeamento arma→spell confiável nas bases públicas do Albion.
const itemHasActiveSkills = (itemId) =>
  /_(MAIN|2H|OFF)_/.test(String(itemId || '')) || /_OFF_/.test(String(itemId || ''));

const ManualSkillEditor = ({ slotLabel, itemId, skills, onChange, onClose }) => {
  const hasActive = itemHasActiveSkills(itemId);
  const itemIcon = getAlbionIconUrl(itemId);

  return (
    <div className="bg-zinc-900/60 rounded-lg border border-amber-500/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <img
          src={itemIcon}
          alt={itemId}
          className="w-8 h-8 rounded border border-zinc-700 bg-zinc-950"
          loading="lazy"
        />
        <h4 className="text-sm font-semibold text-zinc-200">Habilidades — {slotLabel}</h4>
        <span className="ml-auto text-[10px] text-zinc-500 font-mono">{itemId}</span>
        {onClose && (
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-[11px] text-zinc-500 mb-3">
        Digite as habilidades desta build. Ícones oficiais por skill não estão disponíveis nas bases
        públicas do Albion para armas/armaduras — use os nomes das skills que a build utiliza.
      </p>

      {hasActive && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          {['Q', 'W', 'E'].map((key) => (
            <div key={key}>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono uppercase">
                  <Swords className="w-3 h-3" /> {key}
                </span>
              </label>
              <input
                type="text"
                value={skills[key] || ''}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={`Skill ${key}`}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-zinc-800 pt-3">
        <label className="block text-[11px] font-medium text-zinc-400 mb-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono uppercase">
            <Sparkles className="w-3 h-3" /> Passiva
          </span>
        </label>
        <input
          type="text"
          value={skills.passive_P1 || ''}
          onChange={(e) => onChange('passive_P1', e.target.value)}
          placeholder="Passiva"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 mb-2"
        />
        <div className="flex flex-wrap gap-1.5">
          {COMMON_PASSIVES.map((cp) => (
            <button
              key={cp}
              type="button"
              onClick={() => onChange('passive_P1', cp)}
              className={[
                'rounded border px-2 py-1 text-[11px] transition-all',
                skills.passive_P1 === cp
                  ? 'border-amber-500 bg-amber-500/10 text-zinc-100'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-amber-500/50',
              ].join(' ')}
            >
              {cp}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const SkillSelectorDynamic = ({ slotLabel, itemId, skills, onChange, onClose }) => {
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!itemId) return;

    const loadItemSkills = async () => {
      setLoading(true);
      setError(null);

      try {
        const row = await getItemWithSkills(itemId);
        if (row) {
          setItemData(row);
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

  if (error || !itemData || (
    (!itemData.active_skills || itemData.active_skills.length === 0) &&
    (!itemData.passive_skills || itemData.passive_skills.length === 0)
  )) {
    return (
      <ManualSkillEditor
        slotLabel={slotLabel}
        itemId={itemId}
        skills={skills}
        onChange={onChange}
        onClose={onClose}
      />
    );
  }

  const activeSkills = itemData.active_skills || [];
  const passiveSkills = itemData.passive_skills || [];
  const groupedActive = activeSkills.reduce((acc, skill) => {
    const rawSlot = String(skill?.slot || '').toUpperCase();
    const rawKey = String(skill?.key || '').toUpperCase();
    const group = ['Q', 'W', 'E'].includes(rawSlot)
      ? rawSlot
      : ['Q', 'W', 'E'].includes(rawKey[0])
        ? rawKey[0]
        : 'ACTIVE';
    if (!acc[group]) acc[group] = [];
    acc[group].push(skill);
    return acc;
  }, {});

  return (
    <div className="bg-zinc-900/60 rounded-lg border border-amber-500/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <h4 className="text-sm font-semibold text-zinc-200">
          Habilidades — {slotLabel}
        </h4>
        <span className="ml-auto text-[10px] text-zinc-500 font-mono">{itemId}</span>
        {onClose && (
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {activeSkills.length > 0 && (
        <div className="space-y-3 mb-3">
          {Object.entries(groupedActive).map(([group, list]) => (
            <div key={group}>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono mr-2 uppercase">
                  <Swords className="w-3 h-3" />
                  {group}
                </span>
                Skill ativa
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {list.map((skill, idx) => (
                  <SkillChoiceButton
                    key={`${group}-${skill.key || idx}`}
                    skill={skill}
                    selected={skills[group] === (skill.name_pt || skill.name || skill.key)}
                    onSelect={(value) => onChange(group, value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {passiveSkills.length > 0 && (
        <div className="border-t border-zinc-800 pt-3">
          <label className="block text-xs font-medium text-zinc-400 mb-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono mr-2 uppercase">
              <Sparkles className="w-3 h-3" />
              P
            </span>
            Passivas
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {passiveSkills.map((skill, idx) => {
              const passiveKey = `passive_${skill.key || idx}`;
              const value = skill.name_pt || skill.name || skill.key;
              return (
                <SkillChoiceButton
                  key={`${passiveKey}-${idx}`}
                  skill={skill}
                  passive
                  selected={skills[passiveKey] === value}
                  onSelect={(selectedValue) => onChange(passiveKey, selectedValue)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildBuilder;

