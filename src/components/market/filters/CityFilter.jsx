import { MapPin } from 'lucide-react';

const CITIES = [
  'Caerleon',
  'Lymhurst',
  'Martlock',
  'FortSterling',
  'Bridgewatch',
  'Thetford',
];

/**
 * CityFilter component - Multi-select filter for cities
 * @param {Array} selectedCities - Currently selected cities
 * @param {Function} onCityChange - Callback when city selection changes
 */

const CityFilter = ({ selectedCities = [], onCityChange }) => {
  const handleCityToggle = (city) => {
    if (selectedCities.includes(city)) {
      onCityChange(selectedCities.filter((c) => c !== city));
    } else {
      onCityChange([...selectedCities, city]);
    }
  };

  const handleSelectAll = () => {
    onCityChange(CITIES);
  };

  const handleClearAll = () => {
    onCityChange([]);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-300">Cidades</span>
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
        {CITIES.map((city) => (
          <button
            key={city}
            onClick={() => handleCityToggle(city)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCities.includes(city)
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {city}
          </button>
        ))}
      </div>

      {selectedCities.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <span className="text-xs text-gray-500">
            {selectedCities.length} cidade{selectedCities.length !== 1 ? 's' : ''} selecionada
            {selectedCities.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default CityFilter;
