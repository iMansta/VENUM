import { useEffect, useState, useCallback } from 'react';
import {
  fetchBuildCategories,
  fetchBuildsByCategory,
} from '@/lib/supabase/builds';
import {
  ChevronDown,
  ChevronRight,
  Hammer,
  Shield,
  Sword,
  Loader2,
  Info,
} from 'lucide-react';
import BuildCard from '@/components/builds/BuildCard';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

const CATEGORY_ICONS = {
  PvE:        Sword,
  PvP:        Shield,
  Gathering:  Hammer,
};

const getCategoryIcon = (name) => {
  if (!name) return Info;
  const match = Object.keys(CATEGORY_ICONS).find((k) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return match ? CATEGORY_ICONS[match] : Info;
};

export default function Builds() {
  const [categories, setCategories] = useState([]);
  const [expanded,   setExpanded]   = useState({});
  const [buildsByCat, setBuildsByCat] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchBuildCategories();
      setCategories(data || []);
    } catch (e) {
      setErr(e?.message || 'Falha ao carregar categorias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const toggle = useCallback(async (cat) => {
    setExpanded((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }));
    if (!buildsByCat[cat.id]) {
      const list = await fetchBuildsByCategory(cat.id);
      setBuildsByCat((prev) => ({ ...prev, [cat.id]: list || [] }));
    }
  }, [buildsByCat]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-100 mb-1">Catálogo de Builds</h1>
        <p className="text-zinc-400 mb-6 text-sm">
          Builds recomendados pela guilda para diferentes situações no Albion Online.
        </p>
        <LoadingSkeleton variant="list" rows={4} />
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6 text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
        Erro ao carregar builds: {err}
      </div>
    );
  }

  if (!categories.length) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <Info className="w-10 h-10 mx-auto mb-3 opacity-60" />
        Nenhuma categoria de build cadastrada ainda.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Catálogo de Builds</h1>
      <p className="text-zinc-400 mb-6 text-sm">
        Builds recomendados pela guilda para diferentes situações no Albion Online.
      </p>

      <div className="space-y-2">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.name);
          const isOpen = !!expanded[cat.id];
          const builds = buildsByCat[cat.id] || [];

          return (
            <div
              key={cat.id}
              className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(cat)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-amber-400" />
                  <div className="text-left">
                    <div className="font-semibold text-zinc-100">{cat.name}</div>
                    {cat.description && (
                      <div className="text-xs text-zinc-400">{cat.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-zinc-400 text-sm">
                  <span>{cat.build_count ?? 0} builds</span>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-800 p-4 space-y-4 bg-zinc-950/40">
                  {!builds.length ? (
                    <div className="text-zinc-500 text-sm">Nenhuma build nesta categoria.</div>
                  ) : (
                    builds.map((b) => (
                      <BuildCard key={b.id} build={b} />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}