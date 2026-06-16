import { Crown } from 'lucide-react';

/**
 * PremiumFilter component - Filter by premium status (toggle button)
 * @param {string} premium - Current premium value ('all', 'with', 'without')
 * @param {Function} onPremiumChange - Callback when premium changes
 */

const PremiumFilter = ({ premium, onPremiumChange }) => {
  const togglePremium = () => {
    if (premium === 'all') {
      onPremiumChange('with');
    } else if (premium === 'with') {
      onPremiumChange('without');
    } else {
      onPremiumChange('all');
    }
  };

  const getButtonColor = () => {
    if (premium === 'with') return 'bg-amber-500 text-slate-950 border-amber-500';
    if (premium === 'without') return 'bg-slate-600 text-white border-slate-500';
    return 'bg-slate-700 text-gray-400 border-slate-600';
  };

  const getButtonText = () => {
    if (premium === 'with') return 'Com Premium';
    if (premium === 'without') return 'Sem Premium';
    return 'Todos';
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-white text-sm">Premium</h3>
        </div>
        <button
          onClick={togglePremium}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${getButtonColor()}`}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};

export default PremiumFilter;
