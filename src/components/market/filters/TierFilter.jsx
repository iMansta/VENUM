import { Layers } from 'lucide-react';

const TIERS = [4, 5, 6, 7, 8];

const TierFilter = ({ selectedTiers = [], onTierChange }) => {
  const toggle = (tier) => {
    if (selectedTiers.includes(tier)) {
      onTierChange(selectedTiers.filter((t) => t !== tier));
    } else {
      onTierChange([...selectedTiers, tier]);
    }
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-gray-300">Tier</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => toggle(tier)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedTiers.includes(tier)
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            T{tier}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TierFilter;
