import { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import CityFilter from './CityFilter';
import TierFilter from './TierFilter';
import EnchantmentFilter from './EnchantmentFilter';
import QualityFilter from './QualityFilter';
import ProfitFilter from './ProfitFilter';

/**
 * AdvancedFilters component - Container for all market filters
 * @param {Function} onFilterChange - Callback when any filter changes
 */

const AdvancedFilters = ({ onFilterChange }) => {
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedTiers, setSelectedTiers] = useState([]);
  const [selectedEnchantments, setSelectedEnchantments] = useState([]);
  const [selectedQualities, setSelectedQualities] = useState([]);
  const [minProfit, setMinProfit] = useState(0);

  // Trigger filter change when any filter state changes
  useEffect(() => {
    onFilterChange({
      cities: selectedCities,
      tiers: selectedTiers,
      enchantments: selectedEnchantments,
      qualities: selectedQualities,
      minProfit,
    });
  }, [selectedCities, selectedTiers, selectedEnchantments, selectedQualities, minProfit, onFilterChange]);

  const handleClearAll = () => {
    setSelectedCities([]);
    setSelectedTiers([]);
    setSelectedEnchantments([]);
    setSelectedQualities([]);
    setMinProfit(0);
  };

  const hasActiveFilters =
    selectedCities.length > 0 ||
    selectedTiers.length > 0 ||
    selectedEnchantments.length > 0 ||
    selectedQualities.length > 0 ||
    minProfit > 0;

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white">Filtros Avançados</h2>
            {hasActiveFilters && (
              <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
                Ativos
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Limpar Todos
            </button>
          )}
        </div>
      </div>

      {/* Filters Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CityFilter
            selectedCities={selectedCities}
            onCityChange={setSelectedCities}
          />
          <TierFilter
            selectedTiers={selectedTiers}
            onTierChange={setSelectedTiers}
          />
          <EnchantmentFilter
            selectedEnchantments={selectedEnchantments}
            onEnchantmentChange={setSelectedEnchantments}
          />
          <QualityFilter
            selectedQualities={selectedQualities}
            onQualityChange={setSelectedQualities}
          />
          <ProfitFilter
            minProfit={minProfit}
            onMinProfitChange={setMinProfit}
          />
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="bg-slate-800/30 px-6 py-3 border-t border-slate-800">
          <div className="flex flex-wrap gap-2 text-sm">
            {selectedCities.length > 0 && (
              <span className="text-gray-400">
                Cidades: <span className="text-white">{selectedCities.length}</span>
              </span>
            )}
            {selectedTiers.length > 0 && (
              <span className="text-gray-400">
                Tiers: <span className="text-white">{selectedTiers.join(', ')}</span>
              </span>
            )}
            {selectedEnchantments.length > 0 && (
              <span className="text-gray-400">
                Encantamentos: <span className="text-white">{selectedEnchantments.length}</span>
              </span>
            )}
            {selectedQualities.length > 0 && (
              <span className="text-gray-400">
                Qualidades: <span className="text-white">{selectedQualities.length}</span>
              </span>
            )}
            {minProfit > 0 && (
              <span className="text-gray-400">
                Lucro Mínimo: <span className="text-green-400">{minProfit}%</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;
