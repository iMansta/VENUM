import { Award, TrendingUp } from 'lucide-react';

/**
 * PointsDisplay component - Shows user's current points and stats
 */

const PointsDisplay = ({ points, stats }) => {
  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Award className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold text-white">Meus Pontos</h2>
        </div>
      </div>

      {/* Points Display */}
      <div className="p-6">
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-lg p-6 border border-amber-500/30 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-400 text-sm font-medium mb-1">Saldo Atual</p>
              <p className="text-4xl font-bold text-white">{formatNumber(points)}</p>
              <p className="text-amber-300 text-sm mt-1">pontos</p>
            </div>
            <Award className="w-16 h-16 text-amber-500 opacity-50" />
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-gray-400 text-sm">Total Ganho</span>
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatNumber(stats.totalEarned)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-red-400 rotate-180" />
                <span className="text-gray-400 text-sm">Total Gasto</span>
              </div>
              <p className="text-2xl font-bold text-red-400">
                {formatNumber(stats.totalSpent)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PointsDisplay;
