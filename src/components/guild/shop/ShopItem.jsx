import { Package, Award, ShoppingCart, AlertCircle } from 'lucide-react';

/**
 * ShopItem component - Individual shop item card
 */

const ShopItem = ({ item, userPoints, onPurchase }) => {
  const canAfford = userPoints >= item.cost_points;
  const outOfStock = item.stock !== -1 && item.stock <= 0;

  const handlePurchase = () => {
    if (!canAfford) return;
    onPurchase(item);
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 transition-all">
      {/* Item Image/Icon */}
      <div className="w-full h-32 bg-slate-900 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="w-12 h-12 text-gray-600" />
        )}
      </div>

      {/* Item Name */}
      <h3 className="text-lg font-semibold text-white mb-1">{item.name}</h3>

      {/* Description */}
      {item.description && (
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{item.description}</p>
      )}

      {/* Category */}
      <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-slate-700 text-gray-300 mb-3">
        {item.category}
      </span>

      {/* Price */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 text-amber-400">
          <Award className="w-4 h-4" />
          <span className="text-lg font-bold">{item.cost_points}</span>
          <span className="text-sm">pts</span>
        </div>
        {outOfStock && (
          <div className="flex items-center gap-1 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Esgotado</span>
          </div>
        )}
      </div>

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={!canAfford || outOfStock}
        className={`w-full font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
          !canAfford || outOfStock
            ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
            : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
        }`}
      >
        <ShoppingCart className="w-4 h-4" />
        {outOfStock ? 'Esgotado' : !canAfford ? 'Pontos Insuficientes' : 'Comprar'}
      </button>

      {/* Stock Info */}
      {item.stock !== -1 && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Estoque: {item.stock} unidade{item.stock !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default ShopItem;
