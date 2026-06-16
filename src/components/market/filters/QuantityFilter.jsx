import { useState } from 'react';
import { Package } from 'lucide-react';

/**
 * QuantityFilter component - Filter by number of opportunities
 * @param {number} quantity - Current quantity value
 * @param {Function} onQuantityChange - Callback when quantity changes
 */

const QuantityFilter = ({ quantity, onQuantityChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const quantityOptions = [10, 50, 100, 200, 500];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-white text-sm">Quantidade</h3>
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
            value={quantity}
            onChange={(e) => onQuantityChange(parseInt(e.target.value))}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            {quantityOptions.map(opt => (
              <option key={opt} value={opt}>{opt} oportunidades</option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Número de oportunidades a carregar
          </p>
        </div>
      )}
    </div>
  );
};

export default QuantityFilter;
