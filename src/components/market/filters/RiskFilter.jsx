import { ShieldAlert } from 'lucide-react';

/**
 * RiskFilter component - Filter by acceptable risk level
 * @param {string} riskLevel - Current risk level ('all', 'low', 'medium', 'high')
 * @param {Function} onRiskLevelChange - Callback when risk level changes
 */

const RiskFilter = ({ riskLevel, onRiskLevelChange }) => {
  const riskOptions = [
    { value: 'all', label: 'Todos', color: 'bg-slate-700 text-gray-400' },
    { value: 'low', label: 'Baixo Risco', color: 'bg-green-500/20 text-green-400 border-green-500' },
    { value: 'medium', label: 'Risco Médio', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500' },
    { value: 'high', label: 'Alto Risco', color: 'bg-red-500/20 text-red-400 border-red-500' },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-white text-sm">Risco Aceitável</h3>
        </div>
        <select
          value={riskLevel}
          onChange={(e) => onRiskLevelChange(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
        >
          {riskOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default RiskFilter;
