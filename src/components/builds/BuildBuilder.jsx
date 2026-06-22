import { useState, useMemo } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import ItemSlot from './ItemSlot';
import { BUILD_SLOTS, getSlotConfig } from '@/utils/albionItemData';
import { translateItem, parseItemId } from '@/utils/itemTranslator';
import { MARKET_ITEMS } from '@/constants/marketItems';

/**
 * BuildBuilder - Construtor visual de builds do Albian Online.
 *
 * - Grid de slots (Mão Principal, Mão Secundária, Cabeça, etc).
 * - Ao clicar num slot, abre popover com busca de itens (lista mestra
 *   gerada em src/constants/marketItems.js).
 * - Após escolher um item, exibe seletor de habilidades/passivas para
 *   aquele slot.
 * - Salva no formato JSON estruturado:
 *     {
 *       "items": {
 *         "main_hand": { "item_id": "T8_MAIN_HOLYSTAFF@1", "skills": { "Q": "...", "P": "..." } },
 *         ...
 *       },
 *       "version": 2
 *     }
 *
 * Props:
 *   value         objeto JSON atual da build (pode ser {} ou o formato legado)
 *   onChange      callback chamado quando o JSON muda
 *   readOnly      se true, desabilita edição (modo visualização)
 */
const BuildBuilder = ({ value, onChange, readOnly = false }) => {
  // Normaliza o value para o formato novo { items: { slot: { item_id, skills } } }
  const initialItems = useMemo(() => {
    const raw = value?.items || value || {};
    // Legacy: era { slot: 'T8_MAIN_HOLYSTAFF' } (string) ou { slot: { item_id, ... } }
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
  const [search, setSearch] = useState('');

  const emitChange = (newItems) => {
    setItems(newItems);
    if (onChange) onChange({ version: 2, items: newItems });
  };

  const setSlotItem = (slotKey, itemId) => {
    const newItems = { ...items, [slotKey]: { item_id: itemId, skills: items[slotKey]?.skills || {} } };
    emitChange(newItems);
  };

  const clearSlot = (slotKey) => {
    const newItems = { ...items };
    delete newItems[slotKey];
    emitChange(newItems);
    if (openSlot?.slotKey === slotKey) setOpenSlot(null);
  };

  const setSlotSkill = (slotKey, abilityKey, value) => {
    const slot = items[slotKey];
    if (!slot) return;
    const newSkills = { ...slot.skills, [abilityKey]: value };
    const newItems = { ...items, [slotKey]: { ...slot, skills: newSkills } };
    emitChange(newItems);
  };

  const handleSlotClick = (slotInfo) => {
    if (readOnly) return;
    setOpenSlot(slotInfo);
    setSearch('');
  };

  // Lista de itens para o popover, filtrada pelo prefixo do slot
  const filteredItems = useMemo(() => {
    if (!openSlot) return [];
    const prefix = openSlot.iconPrefix;
    const q = search.trim().toLowerCase();

    return MARKET_ITEMS
      .filter((it) => !prefix || it.itemId.includes(prefix))
      .filter((it) => !q || it.itemId.toLowerCase().includes(q))
      .slice(0, 60);
  }, [openSlot, search]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Slots do personagem (Albian Online)
        </h3>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 p-4 bg-zinc-900/60 rounded-lg border border-zinc-800">
          {BUILD_SLOTS.map((slot) => (
            <ItemSlot
              key={slot.key}
              slotKey={slot.key}
              slotLabel={slot.label}
              iconPrefix={slot.icon}
              itemId={items[slot.key]?.item_id || null}
              size={56}
              editable={!readOnly}
              selected={openSlot?.slotKey === slot.key}
              onClick={handleSlotClick}
              onRemove={clearSlot}
            />
          ))}
        </div>
      </div>

      {/* Item picker popover */}
      {!readOnly && openSlot && (
        <ItemPicker
          slotInfo={openSlot}
          items={filteredItems}
          search={search}
          onSearch={setSearch}
          onPick={(itemId) => {
            setSlotItem(openSlot.slotKey, itemId);
          }}
          onClose={() => setOpenSlot(null)}
        />
      )}

      {/* Skill selector — sempre que o slot atual tem item */}
      {!readOnly && openSlot && items[openSlot.slotKey]?.item_id && (
        <SkillSelector
          slotKey={openSlot.slotKey}
          slotLabel={openSlot.slotLabel}
          skills={items[openSlot.slotKey]?.skills || {}}
          onChange={(abilityKey, value) => setSlotSkill(openSlot.slotKey, abilityKey, value)}
        />
      )}

      {/* Resumo JSON (read-only) para debug */}
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

// ============================================================================
// ItemPicker - popover de busca
// ============================================================================
const ItemPicker = ({ slotInfo, items, search, onSearch, onPick, onClose }) => {
  return (
    <div className="border border-amber-500/40 bg-zinc-950 rounded-lg overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <Search className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={`Buscar item para ${slotInfo.slotLabel}...`}
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
        {items.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">
            Nenhum item encontrado para este slot.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {items.map((it) => (
              <ItemPickerCard
                key={it.itemId}
                itemId={it.itemId}
                onPick={() => {
                  onPick(it.itemId);
                  onClose();
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-500 flex items-center justify-between">
        <span>{items.length} itens disponíveis</span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 bg-zinc-800 rounded">Esc</kbd> fecha
        </span>
      </div>
    </div>
  );
};

const ItemPickerCard = ({ itemId, onPick }) => (
  <button
    type="button"
    onClick={onPick}
    title={itemId}
    className="flex flex-col items-center gap-1 p-2 rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-amber-500/50 transition-all group"
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
    <span className="text-[9px] text-zinc-500 font-mono">{parseItemId(itemId).tier ? `T${parseItemId(itemId).tier}` : ''}</span>
  </button>
);

// ============================================================================
// SkillSelector - inputs para habilidades/passivas
// ============================================================================
const SkillSelector = ({ slotKey, slotLabel, skills, onChange }) => {
  const config = getSlotConfig(slotKey);
  if (!config) return null;

  return (
    <div className="bg-zinc-900/60 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <h4 className="text-sm font-semibold text-zinc-200">
          Habilidades & Passivas — {slotLabel}
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {config.abilities.map((ab) => (
          <div key={ab.key}>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono mr-2">
                {ab.key}
              </span>
              {ab.name}
            </label>
            <input
              type="text"
              value={skills[ab.key] || ''}
              onChange={(e) => onChange(ab.key, e.target.value)}
              placeholder={ab.description}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BuildBuilder;