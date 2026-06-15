import { useState, useEffect } from 'react';
import { Store, Filter, ShoppingCart, Package } from 'lucide-react';
import { getShopItems, purchaseShopItem } from '../../../lib/supabase/shop';
import ShopItem from './ShopItem';

/**
 * ShopGrid component - Main shop interface with items grid
 */

const ShopGrid = ({ userPoints, userId, onPurchaseSuccess }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadShopItems();
  }, [selectedCategory]);

  const loadShopItems = async () => {
    setLoading(true);
    const { success, data } = await getShopItems(
      selectedCategory === 'all' ? null : selectedCategory
    );
    if (success) {
      setItems(data);
      // Extract unique categories
      const uniqueCategories = [...new Set(data.map(item => item.category))];
      setCategories(uniqueCategories);
    }
    setLoading(false);
  };

  const handlePurchase = async (item) => {
    const { success, error } = await purchaseShopItem(userId, item.id);
    if (success) {
      onPurchaseSuccess(item);
    } else {
      alert(error || 'Erro ao realizar compra');
    }
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-white">Loja da Guilda</h2>
          </div>
          <div className="flex items-center gap-2 text-amber-400">
            <ShoppingCart className="w-5 h-5" />
            <span className="text-lg font-bold">{userPoints} pts</span>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                  selectedCategory === category
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Carregando itens...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              Nenhum Item Disponível
            </h3>
            <p className="text-gray-500">
              {selectedCategory === 'all'
                ? 'A loja está vazia no momento.'
                : `Não há itens na categoria "${selectedCategory}".`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <ShopItem
                key={item.id}
                item={item}
                userPoints={userPoints}
                onPurchase={handlePurchase}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopGrid;
