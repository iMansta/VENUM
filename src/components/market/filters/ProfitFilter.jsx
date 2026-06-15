import { Percent } from 'lucide-react';

/**
 * ProfitFilter component - Filter for minimum profit percentage
 * @param {number} minProfit - Minimum profit percentage
 * @param {Function} onMinProfitChange - Callback when minimum profit changes
 */

const ProfitFilter = ({ minProfit = 0, onMinProfitChange }) => {
  const presetProfits = [0, 10, 20, 30, 50, 100];

  const handlePresetClick = (value) => {
    onMinProfitChange(value);
  };

  const handleSliderChange = (e) => {
    const value = parseInt(e.target.value);
    onMinProfitChange(value);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Percent className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-gray-300">Margem Mínima</span>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {presetProfits.map((profit) => (
          <button
            key={profit}
            onClick={() => handlePresetClick(profit)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              minProfit === profit
                ? 'bg-green-500 text-white'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {profit}%
          </button>
        ))}
      </div>

      {/* Custom Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Personalizado:</span>
          <span className="text-lg font-bold text-green-400">{minProfit}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          value={minProfit}
          onChange={handleSliderChange}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
        <div className="flex justify-between text-xs text-gray-600">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
          <span>150%</span>
          <span>200%</span>
        </div>
      </div>

      {/* Custom Input */}
      <div className="mt-3">
        <input
          type="number"
          value={minProfit}
          onChange={(e) => onMinProfitChange(parseInt(e.target.value) || 0)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          min="0"
          max="200"
          placeholder="Digite valor personalizado"
        />
      </div>
    </div>
  );
};

export default ProfitFilter;
