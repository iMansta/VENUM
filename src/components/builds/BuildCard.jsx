import { useMemo } from 'react';
import ItemSlot from './ItemSlot';
import { BUILD_SLOTS, getSlotConfig } from '@/utils/albionItemData';

/**
 * BuildCard - Visualização de uma build completa (estilo "Visão Geral"
 * do personagem no jogo).
 *
 * - Layout em grid: coluna esquerda com manequim de equipamento,
 *   coluna direita com habilidades agrupadas.
 * - Slots vazios renderizam como placeholders tracejados.
 * - Suporta tanto o novo formato (slot com item_id + skills) quanto o
 *   legado (slot = string).
 */
const BuildCard = ({ build }) => {
  if (!build) return null;

  // Aceita tanto { items: {...} } quanto {...} legado
  const rawItems = useMemo(() => {
    const v = build?.items ?? build;
    if (!v || typeof v !== 'object') return {};
    // Detecta novo formato: { items: {...} } ou legado: {...} plano
    return v.items && typeof v.items === 'object' ? v.items : v;
  }, [build]);

  const slotsByKey = useMemo(() => {
    const m = {};
    BUILD_SLOTS.forEach((s) => {
      m[s.key] = { ...s, rawValue: rawItems[s.key] };
    });
    return m;
  }, [rawItems]);

  // Item em um slot pode ser:
  //   string → só ID
  //   { item_id, skills } → formato novo
  //   { id, ... } → formato alternativo
  const getSlotItemId = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') return raw.item_id || raw.id || null;
    return null;
  };

  const getSlotSkills = (raw) => {
    if (!raw || typeof raw !== 'object') return {};
    return raw.skills || raw.habilidades || {};
  };

  return (
    <article className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Header */}
      <header className="bg-zinc-800 px-5 py-3 border-b border-zinc-700">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">
              {build?.title || build?.name || 'Build sem título'}
            </h3>
            {build?.author && (
              <p className="text-xs text-zinc-500 mt-0.5">por {build.author}</p>
            )}
          </div>
          {build?.description && (
            <p className="text-sm text-zinc-400 max-w-md whitespace-pre-line">
              {build.description}
            </p>
          )}
        </div>
      </header>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Coluna esquerda: manequim de equipamento */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Equipamento
          </h4>
          <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-950/60 rounded border border-zinc-800">
            {/* Top row: head */}
            <div className="col-span-3 flex justify-center">
              <ItemSlot
                slotKey="head"
                slotLabel={slotsByKey.head.label}
                iconPrefix={slotsByKey.head.icon}
                itemId={getSlotItemId(rawItems.head)}
                size={48}
              />
            </div>
            {/* Main row */}
            <div className="col-span-3 flex justify-center gap-3">
              <ItemSlot
                slotKey="main_hand"
                slotLabel={slotsByKey.main_hand.label}
                iconPrefix={slotsByKey.main_hand.icon}
                itemId={getSlotItemId(rawItems.main_hand)}
                size={48}
              />
              <ItemSlot
                slotKey="off_hand"
                slotLabel={slotsByKey.off_hand.label}
                iconPrefix={slotsByKey.off_hand.icon}
                itemId={getSlotItemId(rawItems.off_hand)}
                size={48}
              />
            </div>
            {/* Armor */}
            <div className="col-span-3 flex justify-center">
              <ItemSlot
                slotKey="armor"
                slotLabel={slotsByKey.armor.label}
                iconPrefix={slotsByKey.armor.icon}
                itemId={getSlotItemId(rawItems.armor)}
                size={48}
              />
            </div>
            {/* Shoes */}
            <div className="col-span-3 flex justify-center">
              <ItemSlot
                slotKey="shoes"
                slotLabel={slotsByKey.shoes.label}
                iconPrefix={slotsByKey.shoes.icon}
                itemId={getSlotItemId(rawItems.shoes)}
                size={48}
              />
            </div>
            {/* Cape */}
            <div className="col-span-3 flex justify-center">
              <ItemSlot
                slotKey="cape"
                slotLabel={slotsByKey.cape.label}
                iconPrefix={slotsByKey.cape.icon}
                itemId={getSlotItemId(rawItems.cape)}
                size={48}
              />
            </div>
          </div>

          {/* Consumíveis: bag, food, potion, mount */}
          <div className="grid grid-cols-4 gap-2 p-2 bg-zinc-950/40 rounded border border-zinc-800/60">
            {['bag', 'food', 'potion', 'mount'].map((k) => (
              <ItemSlot
                key={k}
                slotKey={k}
                slotLabel={slotsByKey[k].label}
                iconPrefix={slotsByKey[k].icon}
                itemId={getSlotItemId(rawItems[k])}
                size={36}
              />
            ))}
          </div>
        </div>

        {/* Coluna direita: habilidades por slot */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Habilidades & Passivas
          </h4>

          {BUILD_SLOTS.filter((s) => ['main_hand', 'off_hand', 'head', 'armor', 'shoes', 'cape'].includes(s.key))
            .map((slot) => {
              const itemId = getSlotItemId(rawItems[slot.key]);
              const skills = getSlotSkills(rawItems[slot.key]);
              const filledSkills = Object.entries(skills).filter(([, v]) => v && String(v).trim());
              if (!itemId && filledSkills.length === 0) return null;

              return (
                <SkillPanel
                  key={slot.key}
                  slotLabel={slot.label}
                  itemId={itemId}
                  skills={filledSkills}
                />
              );
            })}

          {Object.keys(rawItems).length === 0 && (
            <p className="text-sm text-zinc-500 italic">
              Esta build ainda não tem itens configurados.
            </p>
          )}
        </div>
      </div>
    </article>
  );
};

// ============================================================================
// SkillPanel - mostra habilidades de um slot (read-only)
// ============================================================================
const SkillPanel = ({ slotLabel, itemId, skills }) => {
  const config = getSlotConfig(slotLabel === 'Mão Principal' ? 'main_hand' : 'main_hand');
  return (
    <section className="bg-zinc-950/60 rounded border border-zinc-800 p-3">
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            {slotLabel}
          </span>
          {itemId && (
            <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[180px]" title={itemId}>
              {itemId}
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {skills.map(([abilityKey, value]) => (
          <div
            key={abilityKey}
            className="flex items-start gap-2 bg-zinc-900 rounded px-2 py-1.5 border border-zinc-800"
          >
            <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono text-[10px] flex-shrink-0">
              {abilityKey}
            </span>
            <span className="text-xs text-zinc-300 line-clamp-2">{value}</span>
          </div>
        ))}
        {skills.length === 0 && (
          <span className="text-xs text-zinc-500 italic">Sem habilidades configuradas.</span>
        )}
      </div>
    </section>
  );
};

export default BuildCard;