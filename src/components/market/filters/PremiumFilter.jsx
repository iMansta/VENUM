import { useState } from 'react';
import { Crown } from 'lucide-react';

/**
 * PremiumFilter component - Filter by premium status
 * @param {string} premium - Current premium value ('all', 'with', 'without')
 * @param {Function} onPremiumChange - Callback when premium changes
 */

const PremiumFilter = ({ premium, onPremiumChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-white text-sm">Premium</h3>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-400 hover:text-white text-xs transition-colors"
        >
          {isOpen ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-2">
          <select
            value={premium}
            onChange={(e) => onPremiumChange(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="all">Todos</option>
            <option value="with">Com Premium</option>
            <option value="without">Sem Premium</option>
          </select>
          <p className="text-xs text-gray-500">
            Influencia na taxa de venda para Black Market
          </p>
        </div>
      )}
    </div>
  );
};

export default PremiumFilter;
