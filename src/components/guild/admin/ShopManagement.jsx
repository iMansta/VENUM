import { useState, useEffect, useMemo } from 'react';
import { Store, Trash2, Edit2, Save, Search, PackageCheck, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { createShopItem, updateShopItem, deleteShopItem } from '@/lib/supabase/shop';
import {
  getCatalogItemsMeta,
  mapShopCategoryFromGroup,
  searchCatalogItemsForShop,
  SHOP_CATALOG_GROUPS,
} from '@/lib/supabase/catalog';
import { cleanItemName } from '@/utils/itemTranslator';

const GROUP_OPTIONS = Object.entries(SHOP_CATALOG_GROUPS).map(([key, cfg]) => ({
  value: key,
  label: cfg.label,
}));

const emptyForm = {
  catalog_item_id: '',
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

  const [catalogGroup, setCatalogGroup] = useState('mounts');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogMeta, setCatalogMeta] = useState({});
  const [listCategoryFilter, setListCategoryFilter] = useState('all');
  const [listStatusFilter, setListStatusFilter] = useState('all');

  const resolvedItems = useMemo(
    () =>
      (items || []).map((item) => {
        const meta = item.catalog_item_id ? catalogMeta[item.catalog_item_id] : null;
        return {
          ...item,
          resolved_name: cleanItemName(meta?.name_pt || item.name, item.catalog_item_id),
          resolved_image_url: meta?.image_url || item.image_url,
        };
      }),
    [items, catalogMeta]
  );

  const filteredList = useMemo(
    () =>
      resolvedItems.filter((item) => {
        if (listCategoryFilter !== 'all' && item.category !== listCategoryFilter) return false;
        if (listStatusFilter === 'active' && !item.is_active) return false;
        if (listStatusFilter === 'inactive' && item.is_active) return false;
        return true;
      }),
    [resolvedItems, listCategoryFilter, listStatusFilter]
  );

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const rows = await searchCatalogItemsForShop({
        group: catalogGroup,
        search: catalogSearch,
        limit: 80,
      });
      setCatalogItems(rows);
    } catch {
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shop_items')
      .select('*')
      .order('created_at', { ascending: false });
    const rows = data || [];
    setItems(rows);
    const ids = rows.map((x) => x.catalog_item_id).filter(Boolean);
    if (ids.length > 0) {
      setCatalogMeta(await getCatalogItemsMeta(ids));
    } else {
      setCatalogMeta({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadCatalog, 250);
    return () => clearTimeout(t);
  }, [catalogGroup, catalogSearch]);

  const selectCatalogItem = (item) => {
    const category = mapShopCategoryFromGroup(catalogGroup);
    setForm((prev) => ({
      ...prev,
      catalog_item_id: item.item_id,
      name: cleanItemName(item.name_pt, item.item_id) || item.item_id,
      image_url: item.image_url || prev.image_url,
      description: prev.description || item.subcategory || '',
      category,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.catalog_item_id && !form.name.trim()) return;

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
      catalog_item_id: item.catalog_item_id || '',
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

  const handleDuplicate = async (item) => {
    const payload = {
      catalog_item_id: item.catalog_item_id || '',
      name: `${item.resolved_name || item.name} (cópia)`,
      description: item.description || '',
      category: item.category || 'geral',
      cost_points: item.cost_points || 0,
      stock: item.stock ?? -1,
      image_url: item.image_url || '',
      is_active: item.is_active !== false,
    };
    await createShopItem(payload);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Store className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-white">Gerenciar Loja</h3>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
        <p className="text-sm text-gray-300 font-medium">1) Escolha item do catálogo Albion</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={catalogGroup}
            onChange={(e) => setCatalogGroup(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
          >
            {GROUP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Buscar item no catálogo..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded pl-9 pr-3 py-2 text-white text-sm"
            />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2 max-h-64 overflow-y-auto">
          {catalogLoading ? (
            <p className="text-xs text-gray-500 p-2">Carregando catálogo...</p>
          ) : catalogItems.length === 0 ? (
            <p className="text-xs text-gray-500 p-2">Nenhum item encontrado.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {catalogItems.map((item) => (
                <button
                  key={item.item_id}
                  type="button"
                  onClick={() => selectCatalogItem(item)}
                  className={`rounded border p-2 text-left transition-colors ${
                    form.catalog_item_id === item.item_id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-700 bg-slate-800 hover:border-amber-500/60'
                  }`}
                >
                  <img
                    src={item.image_url}
                    alt={item.name_pt}
                    className="w-full h-14 object-contain rounded bg-slate-900/70 mb-1"
                    loading="lazy"
                  />
                  <p className="text-[11px] text-white line-clamp-2">{item.name_pt}</p>
                  <p className="text-[10px] text-gray-500">T{item.tier || '?'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3"
      >
        <p className="text-sm text-gray-300 font-medium">
          {editingId ? '2) Editar item da loja' : '2) Configurar e adicionar item'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-amber-400/90 mb-1">
              ID do catálogo Albion
            </label>
            <p className="text-[11px] text-gray-500 mb-1.5">
              Preenchido ao clicar num item acima. É o código oficial (ex.: T8_MOUNT_ARMORED_HORSE) usado para buscar ícone e nome.
            </p>
            <input
              placeholder="Ex.: T8_MOUNT_ARMORED_HORSE"
              value={form.catalog_item_id}
              onChange={(e) => setForm({ ...form, catalog_item_id: e.target.value.toUpperCase() })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-amber-400/90 mb-1">
              Nome exibido na loja
            </label>
            <p className="text-[11px] text-gray-500 mb-1.5">
              Preenchido automaticamente em PT-BR. Você pode personalizar (ex.: "Cavalo Blindado T8 — Premiação").
            </p>
            <input
              placeholder="Nome do item (PT-BR)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-amber-400/90 mb-1">
              Categoria da loja
            </label>
            <p className="text-[11px] text-gray-500 mb-1.5">
              Grupo usado para filtrar itens (ex.: montarias, armas, consumiveis). Definido automático pelo tipo escolhido.
            </p>
            <input
              placeholder="Ex.: montarias"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-amber-400/90 mb-1">
              Custo em pontos
            </label>
            <p className="text-[11px] text-gray-500 mb-1.5">
              Quantos pontos de guilda o membro gasta para resgatar este item.
            </p>
            <input
              type="number"
              placeholder="Ex.: 100"
              value={form.cost_points}
              onChange={(e) => setForm({ ...form, cost_points: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
              min="1"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-amber-400/90 mb-1">
              Estoque disponível
            </label>
            <p className="text-[11px] text-gray-500 mb-1.5">
              Quantidade em estoque. Use <span className="text-gray-300">-1</span> para estoque ilimitado.
            </p>
            <input
              type="number"
              placeholder="-1 = ilimitado"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-amber-400/90 mb-1">
              Descrição (opcional)
            </label>
            <p className="text-[11px] text-gray-500 mb-1.5">
              Detalhes/regras do item para o membro (ex.: encantamento, condições de entrega). Aparece na loja.
            </p>
            <textarea
              placeholder="Ex.: Montaria T8 entregue em Caerleon após confirmação do oficial."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm min-h-[60px]"
            />
          </div>
          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Item ativo na loja (desmarque para ocultar sem excluir)
          </label>
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

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={listCategoryFilter}
          onChange={(e) => setListCategoryFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white text-xs"
        >
          <option value="all">Todas categorias</option>
          {Array.from(new Set(resolvedItems.map((x) => x.category).filter(Boolean))).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={listStatusFilter}
          onChange={(e) => setListStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white text-xs"
        >
          <option value="all">Todos status</option>
          <option value="active">Somente ativos</option>
          <option value="inactive">Somente inativos</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando…</p>
      ) : filteredList.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum item cadastrado.</p>
      ) : (
        <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-800/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.resolved_image_url ? (
                  <img
                    src={item.resolved_image_url}
                    alt={item.resolved_name || item.name}
                    className="w-12 h-12 rounded object-contain bg-slate-900"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center">
                    <PackageCheck className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{item.resolved_name || item.name}</p>
                  <p className="text-xs text-gray-400">
                    {item.cost_points} pts · {item.category} · estoque{' '}
                    {item.stock === -1 ? '∞' : item.stock} · {item.is_active ? 'ativo' : 'inativo'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDuplicate(item)}
                  className="p-2 text-gray-400 hover:text-amber-400"
                  title="Duplicar item"
                >
                  <Copy className="w-4 h-4" />
                </button>
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
