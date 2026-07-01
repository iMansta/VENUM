import { useState, useEffect } from 'react';
import { Store, Trash2, Edit2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { createShopItem, updateShopItem, deleteShopItem } from '@/lib/supabase/shop';

const emptyForm = {
  name: '',
  description: '',
  category: 'geral',
  cost_points: 100,
  stock: -1,
  image_url: '',
  is_active: true,
};

const ShopManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shop_items')
      .select('*')
      .order('cost_points', { ascending: true });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    const payload = {
      ...form,
      cost_points: Number(form.cost_points) || 0,
      stock: Number(form.stock),
    };

    if (editingId) {
      await updateShopItem(editingId, payload);
    } else {
      await createShopItem(payload);
    }

    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
    load();
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      description: item.description || '',
      category: item.category || 'geral',
      cost_points: item.cost_points || 0,
      stock: item.stock ?? -1,
      image_url: item.image_url || '',
      is_active: item.is_active !== false,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este item da loja?')) return;
    await deleteShopItem(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Store className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-white">Gerenciar Loja</h3>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3"
      >
        <p className="text-sm text-gray-400">
          {editingId ? 'Editar item' : 'Novo item na loja'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            placeholder="Nome do item"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
            required
          />
          <input
            placeholder="Categoria (ex: consumivel, equipamento)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
          />
          <input
            type="number"
            placeholder="Custo em pontos"
            value={form.cost_points}
            onChange={(e) => setForm({ ...form, cost_points: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
          />
          <input
            type="number"
            placeholder="Estoque (-1 = ilimitado)"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
          />
          <input
            placeholder="URL da imagem (opcional)"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm md:col-span-2"
          />
          <textarea
            placeholder="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm md:col-span-2 min-h-[60px]"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 rounded font-medium text-sm"
          >
            <Save className="w-4 h-4" />
            {editingId ? 'Salvar' : 'Adicionar'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="px-4 py-2 text-gray-400 text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum item cadastrado.</p>
      ) : (
        <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-800/30"
            >
              <div>
                <p className="text-white font-medium">{item.name}</p>
                <p className="text-xs text-gray-400">
                  {item.cost_points} pts · {item.category} · estoque{' '}
                  {item.stock === -1 ? '∞' : item.stock}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShopManagement;
