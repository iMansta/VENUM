import { Sparkles } from 'lucide-react';

const ENCHANTMENTS = [
  { value: 0, label: '.0' },
  { value: 1, label: '.1' },
  { value: 2, label: '.2' },
  { value: 3, label: '.3' },
];

const EnchantmentFilter = ({ selectedEnchantments = [], onEnchantmentChange }) => {
  const toggle = (value) => {
    if (selectedEnchantments.includes(value)) {
      onEnchantmentChange(selectedEnchantments.filter((e) => e !== value));
    } else {
      onEnchantmentChange([...selectedEnchantments, value]);
    }
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-gray-300">Encantamento</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {ENCHANTMENTS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedEnchantments.includes(value)
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EnchantmentFilter;
