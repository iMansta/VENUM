import { Sparkles } from 'lucide-react';

const ENCHANTMENTS = [0, 1, 2, 3, 4];

/**
 * EnchantmentFilter component - Multi-select filter for enchantment levels
 * @param {Array} selectedEnchantments - Currently selected enchantment levels
 * @param {Function} onEnchantmentChange - Callback when enchantment selection changes
 */

const EnchantmentFilter = ({ selectedEnchantments = [], onEnchantmentChange }) => {
  const handleEnchantmentToggle = (level) => {
    if (selectedEnchantments.includes(level)) {
      onEnchantmentChange(selectedEnchantments.filter((e) => e !== level));
    } else {
      onEnchantmentChange([...selectedEnchantments, level]);
    }
  };

  const handleSelectAll = () => {
    onEnchantmentChange(ENCHANTMENTS);
  };

  const handleClearAll = () => {
    onEnchantmentChange([]);
  };

  const getEnchantmentSymbol = (level) => {
    if (level === 0) return '0';
    return `.${level}`;
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-300">Encantamento</span>
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
        {ENCHANTMENTS.map((level) => (
          <button
            key={level}
            onClick={() => handleEnchantmentToggle(level)}
            className={`w-10 h-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
              selectedEnchantments.includes(level)
                ? 'bg-purple-500 text-white'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
            title={`Nível ${level}`}
          >
            {level === 0 ? '0' : getEnchantmentSymbol(level)}
          </button>
        ))}
      </div>

      {selectedEnchantments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <span className="text-xs text-gray-500">
            {selectedEnchantments.length} nível{selectedEnchantments.length !== 1 ? 'eis' : ''} selecionado
            {selectedEnchantments.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default EnchantmentFilter;
