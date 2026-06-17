import { Coins } from 'lucide-react';

/**
 * InvestmentFilter component - Filter by maximum investment cost
 * @param {number} maxInvestment - Current maximum investment value
 * @param {Function} onMaxInvestmentChange - Callback when max investment changes
 */

const InvestmentFilter = ({ maxInvestment, onMaxInvestmentChange }) => {
  const investmentOptions = [
    { value: 10000, label: '10k' },
    { value: 50000, label: '50k' },
    { value: 100000, label: '100k' },
    { value: 250000, label: '250k' },
    { value: 500000, label: '500k' },
    { value: 1000000, label: '1M' },
    { value: Infinity, label: 'Sem limite' },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-white text-sm">Investimento Máximo</h3>
        </div>
        <select
          value={maxInvestment === Infinity ? 'Infinity' : maxInvestment}
          onChange={(e) => onMaxInvestmentChange(e.target.value === 'Infinity' ? Infinity : parseInt(e.target.value))}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
        >
          {investmentOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default InvestmentFilter;
