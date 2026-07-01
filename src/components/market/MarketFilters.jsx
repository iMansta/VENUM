import { useState, useMemo } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

const ROYAL_CITIES = ['Martlock', 'Thetford', 'Fort Sterling', 'Lymhurst', 'Bridgewatch'];
const TIERS = [4, 5, 6, 7, 8];

const DEFAULT = {
  tiers: [],
  cities: [],
  minProfit: 0,
  minMargin: 0,
  sort: 'profit',
  search: '',
};

export const applyMarketFilters = (opportunities, filters) => {
  let list = [...(opportunities || [])];

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (o) =>
        o.itemId?.toLowerCase().includes(q) ||
        o.lowestCity?.toLowerCase().includes(q)
    );
  }

  if (filters.tiers?.length) {
    list = list.filter((o) => {
      const m = o.itemId?.match(/^T(\d)/);
      return m && filters.tiers.includes(Number(m[1]));
    });
  }

  if (filters.cities?.length) {
    list = list.filter((o) => filters.cities.includes(o.lowestCity));
  }

  if (filters.minProfit > 0) {
    list = list.filter((o) => (o.netProfit || 0) >= filters.minProfit);
  }

  if (filters.minMargin > 0) {
    list = list.filter((o) => {
      const m = Number(o.marginPct ?? o.margin ?? 0);
      const pct = m <= 1 ? m * 100 : m;
      return pct >= filters.minMargin;
    });
  }

  if (filters.sort === 'margin') {
    list.sort((a, b) => (b.marginPct || 0) - (a.marginPct || 0));
  } else if (filters.sort === 'tier') {
    list.sort((a, b) => (b.itemId || '').localeCompare(a.itemId || ''));
  } else {
    list.sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0));
  }

  return list;
};

const MarketFilters = ({ filters, onChange, resultCount, totalCount }) => {
  const [open, setOpen] = useState(true);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.tiers?.length) n++;
    if (filters.cities?.length) n++;
    if (filters.minProfit > 0) n++;
    if (filters.minMargin > 0) n++;
    if (filters.search?.trim()) n++;
    return n;
  }, [filters]);

  const toggleTier = (t) => {
    const cur = filters.tiers || [];
    onChange({
      ...filters,
      tiers: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    });
  };

  const toggleCity = (c) => {
    const cur = filters.cities || [];
    onChange({
      ...filters,
      cities: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    });
  };

  const clearAll = () => onChange({ ...DEFAULT });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <SlidersHorizontal className="w-4 h-4 text-red-400" />
          Filtros
          {activeCount > 0 && (
            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-xs text-gray-400">
          {resultCount} de {totalCount} oportunidades
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4 border-t border-slate-800">
          <input
            type="text"
            placeholder="Buscar item ou cidade..."
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:outline-none"
          />

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Tier</p>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTier(t)}
                  className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${
                    filters.tiers?.includes(t)
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-gray-400 hover:text-white'
                  }`}
                >
                  T{t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Cidade de compra</p>
            <div className="flex flex-wrap gap-2">
              {ROYAL_CITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCity(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    filters.cities?.includes(c)
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Lucro mínimo (silver)</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={filters.minProfit || ''}
                onChange={(e) =>
                  onChange({ ...filters, minProfit: Number(e.target.value) || 0 })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Margem mín. (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={filters.minMargin || ''}
                onChange={(e) =>
                  onChange({ ...filters, minMargin: Number(e.target.value) || 0 })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Ordenar por</label>
            <select
              value={filters.sort || 'profit'}
              onChange={(e) => onChange({ ...filters, sort: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="profit">Maior lucro</option>
              <option value="margin">Maior margem</option>
              <option value="tier">Tier (item)</option>
            </select>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
            >
              <X className="w-3 h-3" />
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketFilters;
