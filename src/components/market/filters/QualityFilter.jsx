import { Gem } from 'lucide-react';

const QUALITIES = [
  { value: 1, name: 'Normal', color: 'bg-gray-500' },
  { value: 2, name: 'Good', color: 'bg-green-500' },
  { value: 3, name: 'Outstanding', color: 'bg-blue-500' },
  { value: 4, name: 'Excellent', color: 'bg-purple-500' },
  { value: 5, name: 'Masterpiece', color: 'bg-amber-500' },
];

/**
 * QualityFilter component - Multi-select filter for item quality levels
 * @param {Array} selectedQualities - Currently selected quality values
 * @param {Function} onQualityChange - Callback when quality selection changes
 */

const QualityFilter = ({ selectedQualities = [], onQualityChange }) => {
  const handleQualityToggle = (value) => {
    if (selectedQualities.includes(value)) {
      onQualityChange(selectedQualities.filter((q) => q !== value));
    } else {
      onQualityChange([...selectedQualities, value]);
    }
  };

  const handleSelectAll = () => {
    onQualityChange(QUALITIES.map((q) => q.value));
  };

  const handleClearAll = () => {
    onQualityChange([]);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gem className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-300">Qualidade</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Todas
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
        {QUALITIES.map((quality) => (
          <button
            key={quality.value}
            onClick={() => handleQualityToggle(quality.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              selectedQualities.includes(quality.value)
                ? quality.color + ' text-white'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
            title={quality.name}
          >
            <div className={`w-2 h-2 rounded-full ${quality.color}`} />
            {quality.name}
          </button>
        ))}
      </div>

      {selectedQualities.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <span className="text-xs text-gray-500">
            {selectedQualities.length} qualidade{selectedQualities.length !== 1 ? 's' : ''} selecionada
            {selectedQualities.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default QualityFilter;
