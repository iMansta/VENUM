import { useState } from 'react';
import { X, ShoppingCart, Award, AlertCircle, Check } from 'lucide-react';

/**
 * PurchaseModal component - Modal for confirming shop purchases
 */

const PurchaseModal = ({ item, userPoints, onConfirm, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const canAfford = userPoints >= item.cost_points;
  const remainingPoints = userPoints - item.cost_points;

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(item);
    setConfirmed(true);
    setLoading(false);
  };

  if (confirmed) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Compra Realizada!</h3>
            <p className="text-gray-400 mb-4">
              Você comprou <span className="text-white font-medium">{item.name}</span>
            </p>
            <button
              onClick={onClose}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Confirmar Compra</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Item Details */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-20 h-20 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <ShoppingCart className="w-8 h-8 text-gray-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-gray-400 mb-2">{item.description}</p>
              )}
              <div className="flex items-center gap-1 text-amber-400">
                <Award className="w-4 h-4" />
                <span className="font-bold">{item.cost_points} pts</span>
              </div>
            </div>
          </div>

          {/* Warning if can't afford */}
          {!canAfford && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-300 font-medium">Pontos Insuficientes</p>
                <p className="text-xs text-red-400">
                  Você precisa de {item.cost_points - userPoints} pontos adicionais.
                </p>
              </div>
            </div>
          )}

          {/* Points Summary */}
          <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Saldo Atual:</span>
              <span className="text-white font-medium">{userPoints} pts</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Custo:</span>
              <span className="text-red-400 font-medium">-{item.cost_points} pts</span>
            </div>
            <div className="border-t border-slate-700 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">Saldo Restante:</span>
                <span className={`font-bold ${remainingPoints >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {remainingPoints} pts
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canAfford || loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {loading ? 'Processando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseModal;
