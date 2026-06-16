import { Package } from 'lucide-react';

/**
 * QuantityFilter component - Filter by number of opportunities (dialog only)
 * @param {number} quantity - Current quantity value
 * @param {Function} onQuantityChange - Callback when quantity changes
 */

const QuantityFilter = ({ quantity, onQuantityChange }) => {
  const quantityOptions = [10, 50, 100, 200, 500];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-white text-sm">Quantidade</h3>
        </div>
        <select
          value={quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value))}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
        >
          {quantityOptions.map(opt => (
            <option key={opt} value={opt}>{opt} oportunidades</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default QuantityFilter;
