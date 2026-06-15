import { Layers } from 'lucide-react';

const TIERS = [4, 5, 6, 7, 8];

/**
 * TierFilter component - Multi-select filter for item tiers
 * @param {Array} selectedTiers - Currently selected tiers
 * @param {Function} onTierChange - Callback when tier selection changes
 */

const TierFilter = ({ selectedTiers = [], onTierChange }) => {
  const handleTierToggle = (tier) => {
    if (selectedTiers.includes(tier)) {
      onTierChange(selectedTiers.filter((t) => t !== tier));
    } else {
      onTierChange([...selectedTiers, tier]);
    }
  };

  const handleSelectAll = () => {
    onTierChange(TIERS);
  };

  const handleClearAll = () => {
    onTierChange([]);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-300">Tier</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Todos
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={handleClearAll}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => handleTierToggle(tier)}
            className={`w-10 h-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
              selectedTiers.includes(tier)
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            T{tier}
          </button>
        ))}
      </div>

      {selectedTiers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <span className="text-xs text-gray-500">
            {selectedTiers.length} tier{selectedTiers.length !== 1 ? 's' : ''} selecionado
            {selectedTiers.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default TierFilter;
