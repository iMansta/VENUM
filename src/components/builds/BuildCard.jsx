import { useMemo } from 'react';
import { Package } from 'lucide-react';
import { getAlbionIconUrl } from '@/utils/albionIcon';
import { translateItem } from '@/utils/itemTranslator';

/**
 * BuildCard - Visualização de uma build completa do Albion Online.
 *
 * Layout: "Visão Geral" de inventário (formato de cruz/manequim).
 *
 *   Esquerda: grid 3x3 com BAG/CAPA/HEAD, MAIN/CHEST/OFF, POTION/SHOES/FOOD
 *             + montaria opcional abaixo.
 *   Direita:  título, autor, descrição, táticas.
 *
 * Slots vazios renderizam como placeholders tracejados.
 */
const SLOT_LABELS = {
  MAIN_HAND: 'Mão Principal',
  OFF_HAND:  'Mão Secundária',
  HEAD:      'Cabeça',
  ARMOR:     'Peito',
  SHOES:     'Calçado',
  CAPE:      'Capa',
  BAG:       'Mochila',
  FOOD:      'Comida',
  POTION:    'Poção',
  MOUNT:     'Montaria',
};

const BuildCard = ({ build }) => {
  if (!build) return null;

  const rawItems = useMemo(() => {
    const v = build?.items ?? build;
    if (!v || typeof v !== 'object') return {};
    return v.items && typeof v.items === 'object' ? v.items : v;
  }, [build]);

  const getItemId = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') return raw.item_id || raw.id || null;
    return null;
  };

  const getSkills = (raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const sk = raw.skills || raw.habilidades || {};
    return Object.entries(sk).filter(([, v]) => v && String(v).trim());
  };

  /**
   * Layout de cruz 3x3 (estilo inventário):
   *   Topo:    [BAG]  [HEAD]  [CAPE]
   *   Meio:    [MAIN] [CHEST] [OFF]
   *   Fundo:   [POT]  [SHOES] [FOOD]
   *
   * Montaria fica em uma linha separada abaixo do grid (à direita).
   */
  const gridSlots = [
    { row: 0, col: 0, slotKey: 'BAG' },
    { row: 0, col: 1, slotKey: 'HEAD' },
    { row: 0, col: 2, slotKey: 'CAPE' },
    { row: 1, col: 0, slotKey: 'MAIN_HAND' },
    { row: 1, col: 1, slotKey: 'ARMOR' },
    { row: 1, col: 2, slotKey: 'OFF_HAND' },
    { row: 2, col: 0, slotKey: 'POTION' },
    { row: 2, col: 1, slotKey: 'SHOES' },
    { row: 2, col: 2, slotKey: 'FOOD' },
  ];

  const renderSlotCell = (slotKey) => {
    const raw = rawItems[slotKey];
    const itemId = getItemId(raw);
    const skills = getSkills(raw);

    return (
      <div className="flex flex-col items-center gap-1.5">
        {itemId ? (
          <div className="relative w-16 h-16 rounded border-2 border-amber-400 bg-zinc-900 shadow-[0_0_8px_rgba(245,158,11,0.3)] overflow-hidden">
            <img
              src={getAlbionIconUrl(itemId)}
              alt={itemId}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.opacity = '0.2';
              }}
            />
            {skills.length > 0 && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-bold flex items-center justify-center shadow">
                {skills.length}
              </span>
            )}
          </div>
        ) : (
          <div
            title={`${SLOT_LABELS[slotKey]} (vazio)`}
            className="w-16 h-16 rounded border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex items-center justify-center"
          >
            <Package className="w-5 h-5 text-zinc-700" />
          </div>
        )}
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold text-center">
          {SLOT_LABELS[slotKey]}
        </span>
      </div>
    );
  };

  // Coletar todas as skills/passivas por slot para exibir no painel direito
  const allSkills = [];
  for (const slotKey of Object.keys(SLOT_LABELS)) {
    const skills = getSkills(rawItems[slotKey]);
    skills.forEach(([key, value]) => {
      allSkills.push({ slot: SLOT_LABELS[slotKey], slotKey, abilityKey: key, value });
    });
  }

  const mountRaw = rawItems.MOUNT;
  const mountId = getItemId(mountRaw);

  return (
    <article className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Header */}
      <header className="bg-zinc-800 px-5 py-3 border-b border-slate-700">
        <h3 className="text-lg font-bold text-zinc-100">
          {build?.title || build?.name || 'Build sem título'}
        </h3>
        {build?.author && (
          <p className="text-xs text-zinc-500 mt-0.5">por {build.author}</p>
        )}
      </header>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Coluna esquerda: MANEQUIM em cruz 3x3 */}
        <div className="flex flex-col items-center">
          <div className="bg-zinc-950/60 rounded-lg p-3 border border-zinc-800 w-full max-w-[260px]">
            <div className="grid grid-cols-3 gap-3">
              {gridSlots.map(({ row, col, slotKey }) => (
                <div
                  key={slotKey}
                  style={{ gridColumn: col + 1, gridRow: row + 1 }}
                >
                  {renderSlotCell(slotKey)}
                </div>
              ))}
            </div>

            {/* Montaria: linha separada abaixo */}
            <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-center">
              <div className="flex flex-col items-center gap-1.5">
                {mountId ? (
                  <div className="relative w-16 h-16 rounded border-2 border-purple-400 bg-zinc-900 shadow-[0_0_8px_rgba(168,85,247,0.3)] overflow-hidden">
                    <img
                      src={getAlbionIconUrl(mountId)}
                      alt={mountId}
                      className="w-full h-full object-contain"
                      onError={(e) => { e.currentTarget.style.opacity = '0.2'; }}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex items-center justify-center">
                    <Package className="w-5 h-5 text-zinc-700" />
                  </div>
                )}
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Montaria
                </span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 mt-2 italic text-center">
            Equipamento da build (Albian Online)
          </p>
        </div>

        {/* Coluna direita: informações e skills/passivas */}
        <div className="space-y-4 min-w-0">
          {/* Táticas / descrição */}
          {build?.description && (
            <section className="bg-zinc-950/60 rounded-lg border border-zinc-800 p-4">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Táticas
              </h4>
              <p className="text-sm text-zinc-300 whitespace-pre-line break-words">
                {build.description}
              </p>
            </section>
          )}

          {/* Skills/Passivas */}
          {allSkills.length > 0 ? (
            <section className="bg-zinc-950/60 rounded-lg border border-zinc-800 p-4">
              <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Habilidades & Passivas
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allSkills.map((s, idx) => (
                  <div
                    key={`${s.slotKey}-${s.abilityKey}-${idx}`}
                    className="bg-zinc-900 rounded px-2 py-1.5 border border-zinc-800"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="inline-block px-1 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono text-[9px] uppercase">
                        {s.abilityKey}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        {s.slot}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 break-words">
                      {translateItem(s.value, { includeTier: false }) || s.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="bg-zinc-950/60 rounded-lg border border-zinc-800 p-4">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Habilidades & Passivas
              </h4>
              <p className="text-xs text-zinc-500 italic">
                Nenhuma habilidade/passiva catalogada para esta build.
              </p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
};

export default BuildCard;