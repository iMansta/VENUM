import { useEffect, useMemo, useState } from 'react';
import { Package, User } from 'lucide-react';
import { getAlbionIconUrl } from '@/utils/albionIcon';
import { translateItem } from '@/utils/itemTranslator';
import { getItemWithSkills } from '@/lib/supabase/catalog';
import ItemIcon from '@/components/market/ItemIcon';

const SLOT_LABELS = {
  MAIN_HAND: 'Mão Principal',
  OFF_HAND: 'Mão Secundária',
  HEAD: 'Cabeça',
  ARMOR: 'Peito',
  SHOES: 'Calçado',
  CAPE: 'Capa',
  BAG: 'Mochila',
  FOOD: 'Comida',
  POTION: 'Poção',
  MOUNT: 'Montaria',
};

const DISPLAY_ORDER = [
  'MAIN_HAND',
  'HEAD',
  'ARMOR',
  'SHOES',
  'CAPE',
  'OFF_HAND',
  'BAG',
  'FOOD',
  'POTION',
  'MOUNT',
];

const skillName = (s) => s?.name_pt || s?.name || s?.key || '';
const norm = (v) => String(v || '').trim().toLowerCase();
const getItemDisplayName = (itemId, template) =>
  template?.name_pt || template?.name || translateItem(itemId, { includeTier: true });

const BuildCard = ({ build }) => {
  const [templatesByItem, setTemplatesByItem] = useState({});

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

  const equipped = useMemo(
    () =>
      DISPLAY_ORDER.filter((slotKey) => getItemId(rawItems[slotKey])).map((slotKey) => ({
        slotKey,
        raw: rawItems[slotKey],
      })),
    [rawItems]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ids = Array.from(new Set(equipped.map((x) => getItemId(x.raw)).filter(Boolean)));
      if (ids.length === 0) {
        setTemplatesByItem({});
        return;
      }

      const next = {};
      await Promise.all(
        ids.map(async (id) => {
          try {
            next[id] = await getItemWithSkills(id);
          } catch {
            next[id] = null;
          }
        })
      );
      if (!cancelled) setTemplatesByItem(next);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [equipped]);

  const selectedSkillsFor = (slotKey, raw) => {
    const selected = getSkills(raw);
    const itemId = getItemId(raw);
    const tpl = itemId ? templatesByItem[itemId] : null;
    const active = Array.isArray(tpl?.active_skills) ? tpl.active_skills : [];
    const passive = Array.isArray(tpl?.passive_skills) ? tpl.passive_skills : [];
    const merged = [...active, ...passive];

    return selected.map(([abilityKey, value], idx) => {
      const valueNorm = norm(value);
      const found = merged.find(
        (s) => norm(skillName(s)) === valueNorm || norm(s?.key) === norm(abilityKey)
      );
      return {
        id: `${slotKey}-${abilityKey}-${idx}`,
        abilityKey,
        label: found ? skillName(found) : String(value),
        icon: found?.icon_url || null,
      };
    });
  };

  const renderGridCell = (slotKey) => {
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
              referrerPolicy="no-referrer"
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

  if (!build) return null;

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

  const mountId = getItemId(rawItems.MOUNT);

  return (
    <article className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <header className="bg-zinc-800 px-5 py-3 border-b border-slate-700">
        <h3 className="text-lg font-bold text-zinc-100">
          {build?.title || build?.name || 'Build sem título'}
        </h3>
        {build?.author && (
          <p className="text-xs text-zinc-500 mt-0.5 inline-flex items-center gap-1">
            <User className="w-3 h-3" /> por {build.author}
          </p>
        )}
      </header>

      <div className="p-5 grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
        <div className="flex flex-col items-center">
          <div className="bg-zinc-950/60 rounded-lg p-3 border border-zinc-800 w-full max-w-[260px]">
            <div className="grid grid-cols-3 gap-3">
              {gridSlots.map(({ row, col, slotKey }) => (
                <div key={slotKey} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
                  {renderGridCell(slotKey)}
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-center">
              <div className="flex flex-col items-center gap-1.5">
                {mountId ? (
                  <div className="relative w-16 h-16 rounded border-2 border-purple-400 bg-zinc-900 shadow-[0_0_8px_rgba(168,85,247,0.3)] overflow-hidden">
                    <img
                      src={getAlbionIconUrl(mountId)}
                      alt={mountId}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0.2';
                      }}
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
        </div>

        <div className="space-y-4 min-w-0">
          <section className="bg-zinc-950/60 rounded-lg border border-zinc-800 p-4">
            <h4 className="text-sm font-semibold text-zinc-200 mb-3">Habilidades & Passivas</h4>
            {equipped.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">Nenhum item equipado na build.</p>
            ) : (
              <div className="space-y-3">
                {equipped.map(({ slotKey, raw }) => {
                  const itemId = getItemId(raw);
                  const selectedSkills = selectedSkillsFor(slotKey, raw);
                  return (
                    <div
                      key={slotKey}
                      className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-2 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ItemIcon itemId={itemId} size={40} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-100 truncate">
                            {getItemDisplayName(itemId, templatesByItem[itemId])}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                            {SLOT_LABELS[slotKey]}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {selectedSkills.length === 0 ? (
                          <span className="text-[10px] text-zinc-600">Sem skill selecionada</span>
                        ) : (
                          selectedSkills.map((s) => (
                            <div
                              key={s.id}
                              className="w-8 h-8 rounded-full border border-zinc-700 overflow-hidden bg-zinc-900"
                              title={`${s.abilityKey}: ${s.label}`}
                            >
                              {s.icon ? (
                                <img src={s.icon} alt={s.label} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full text-[10px] text-zinc-300 flex items-center justify-center font-bold">
                                  {s.abilityKey?.slice(0, 1)?.toUpperCase() || '?'}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {build?.description && (
            <section className="bg-zinc-950/60 rounded-lg border border-zinc-800 p-4">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">Descrição</h4>
              <p className="text-sm text-zinc-300 whitespace-pre-line break-words">{build.description}</p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
};

export default BuildCard;