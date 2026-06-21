import { useState, useEffect } from 'react';
import { Hammer, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import {
  fetchAllCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchBuildsAdmin,
  createBuild,
  updateBuild,
  deleteBuild,
} from '@/lib/supabase/builds';

/**
 * BuildManagement - Admin tab to manage build categories and builds.
 * Provides simple CRUD on `build_categories` and `builds`.
 */

const EMPTY_BUILD = {
  title: '',
  category_id: '',
  author: '',
  items_json: [],
  tactics: '',
};

const EMPTY_CATEGORY = {
  name: '',
  description: '',
};

const parseItems = (raw) => {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
};

const stringifyItems = (items) => {
  if (!Array.isArray(items)) return '';
  return items
    .map((i) => (typeof i === 'string' ? i : i?.name || ''))
    .filter(Boolean)
    .join('\n');
};

export default function BuildManagement() {
  const [categories, setCategories] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [catForm, setCatForm] = useState(EMPTY_CATEGORY);
  const [catEditing, setCatEditing] = useState(null);

  const [buildForm, setBuildForm] = useState(EMPTY_BUILD);
  const [buildEditing, setBuildEditing] = useState(null);
  const [itemsRaw, setItemsRaw] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [cats, allBuilds] = await Promise.all([
        fetchAllCategoriesAdmin(),
        fetchBuildsAdmin(),
      ]);
      setCategories(cats || []);
      setBuilds(allBuilds || []);
    } catch (e) {
      setErr(e?.message || 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const flash = (msg, isError = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3000);
  };

  // ------- Category handlers -------
  const submitCategory = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: catForm.name.trim(),
        description: catForm.description.trim() || null,
      };
      const res = catEditing
        ? await updateCategory(catEditing.id, payload)
        : await createCategory(payload);

      if (!res.success) throw new Error(res.error);

      flash(catEditing ? 'Categoria atualizada.' : 'Categoria criada.');
      setCatForm(EMPTY_CATEGORY);
      setCatEditing(null);
      await loadAll();
    } catch (e2) {
      flash(e2.message || 'Erro ao salvar categoria.', true);
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (cat) => {
    setCatEditing(cat);
    setCatForm({
      name: cat.name || '',
      description: cat.description || '',
    });
  };

  const removeCategory = async (cat) => {
    if (!window.confirm(`Excluir categoria "${cat.name}"? Builds vinculadas serão perdidas.`)) return;
    const res = await deleteCategory(cat.id);
    if (!res.success) {
      flash(res.error || 'Erro ao excluir.', true);
    } else {
      flash('Categoria excluída.');
      await loadAll();
    }
  };

  // ------- Build handlers -------
  const submitBuild = async (e) => {
    e.preventDefault();
    if (!buildForm.category_id) {
      flash('Selecione uma categoria.', true);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: buildForm.title.trim(),
        category_id: buildForm.category_id,
        author: buildForm.author.trim() || null,
        items_json: parseItems(itemsRaw),
        tactics: buildForm.tactics.trim() || null,
      };

      const res = buildEditing
        ? await updateBuild(buildEditing.id, payload)
        : await createBuild(payload);

      if (!res.success) throw new Error(res.error);

      flash(buildEditing ? 'Build atualizada.' : 'Build criada.');
      setBuildForm(EMPTY_BUILD);
      setBuildEditing(null);
      setItemsRaw('');
      await loadAll();
    } catch (e2) {
      flash(e2.message || 'Erro ao salvar build.', true);
    } finally {
      setSaving(false);
    }
  };

  const editBuild = (b) => {
    setBuildEditing(b);
    setBuildForm({
      title: b.title || '',
      category_id: b.category_id || '',
      author: b.author || '',
      items_json: b.items_json || [],
      tactics: b.tactics || '',
    });
    setItemsRaw(stringifyItems(b.items_json));
  };

  const removeBuild = async (b) => {
    if (!window.confirm(`Excluir build "${b.title}"?`)) return;
    const res = await deleteBuild(b.id);
    if (!res.success) {
      flash(res.error || 'Erro ao excluir.', true);
    } else {
      flash('Build excluída.');
      await loadAll();
    }
  };

  const buildsByCategory = (catId) =>
    builds.filter((b) => b.category_id === catId);

  if (loading) {
    return (
      <div className="p-6 text-zinc-400">Carregando gerenciamento de builds…</div>
    );
  }

  if (err) {
    return (
      <div className="p-6 text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
        {err}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            feedback.isError
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Categorias */}
      <section className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <Hammer className="w-5 h-5 text-amber-400" /> Categorias
        </h3>

        <form onSubmit={submitCategory} className="grid gap-3 md:grid-cols-3 mb-4">
          <input
            type="text"
            placeholder="Nome da categoria"
            value={catForm.name}
            onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500"
            required
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={catForm.description}
            onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 md:col-span-2"
          />
          <div className="md:col-span-3 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {catEditing ? 'Salvar alterações' : 'Criar categoria'}
            </button>
            {catEditing && (
              <button
                type="button"
                onClick={() => { setCatEditing(null); setCatForm(EMPTY_CATEGORY); }}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-4 py-2 rounded flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
            )}
          </div>
        </form>

        <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
          {categories.length === 0 && (
            <li className="px-4 py-3 text-zinc-500 text-sm">Nenhuma categoria cadastrada.</li>
          )}
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2">
              <div>
                <div className="text-zinc-100 font-medium">{c.name}</div>
                {c.description && <div className="text-xs text-zinc-500">{c.description}</div>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => editCategory(c)}
                  className="text-amber-400 hover:text-amber-300 p-1"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeCategory(c)}
                  className="text-red-400 hover:text-red-300 p-1"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Builds */}
      <section className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-400" /> Builds
        </h3>

        <form onSubmit={submitBuild} className="grid gap-3 md:grid-cols-2 mb-4">
          <input
            type="text"
            placeholder="Título da build"
            value={buildForm.title}
            onChange={(e) => setBuildForm((f) => ({ ...f, title: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500"
            required
          />
          <input
            type="text"
            placeholder="Autor (opcional)"
            value={buildForm.author}
            onChange={(e) => setBuildForm((f) => ({ ...f, author: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500"
          />
          <select
            value={buildForm.category_id}
            onChange={(e) => setBuildForm((f) => ({ ...f, category_id: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
            required
          >
            <option value="">Selecione uma categoria…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <textarea
            placeholder="Itens (um por linha)"
            value={itemsRaw}
            onChange={(e) => setItemsRaw(e.target.value)}
            rows={4}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 font-mono text-sm"
          />
          <textarea
            placeholder="Táticas / observações (opcional)"
            value={buildForm.tactics}
            onChange={(e) => setBuildForm((f) => ({ ...f, tactics: e.target.value }))}
            rows={3}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 md:col-span-2"
          />
          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {buildEditing ? 'Salvar alterações' : 'Criar build'}
            </button>
            {buildEditing && (
              <button
                type="button"
                onClick={() => { setBuildEditing(null); setBuildForm(EMPTY_BUILD); setItemsRaw(''); }}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-4 py-2 rounded flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          {categories.map((cat) => {
            const list = buildsByCategory(cat.id);
            return (
              <div key={cat.id} className="border border-zinc-800 rounded">
                <div className="px-3 py-2 bg-zinc-800/50 text-sm font-medium text-zinc-300 flex justify-between">
                  <span>{cat.name}</span>
                  <span className="text-zinc-500">{list.length} builds</span>
                </div>
                {list.length === 0 ? (
                  <div className="px-4 py-3 text-zinc-500 text-sm">Nenhuma build nesta categoria.</div>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {list.map((b) => (
                      <li key={b.id} className="px-4 py-2 flex items-center justify-between">
                        <div>
                          <div className="text-zinc-100">{b.title}</div>
                          {b.author && <div className="text-xs text-zinc-500">por {b.author}</div>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => editBuild(b)}
                            className="text-amber-400 hover:text-amber-300 p-1"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeBuild(b)}
                            className="text-red-400 hover:text-red-300 p-1"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}