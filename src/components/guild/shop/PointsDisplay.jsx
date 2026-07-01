import { Award, TrendingUp, TrendingDown } from 'lucide-react';

const PointsDisplay = ({ points = 0, stats = null }) => {
  const formatNumber = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Award className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Seus Pontos</p>
            <p className="text-3xl font-bold text-white">{formatNumber(points)}</p>
          </div>
        </div>
        {stats && (
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <div className="flex items-center gap-1 text-green-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span>Ganhos</span>
              </div>
              <p className="font-semibold text-white">{formatNumber(stats.totalEarned)}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 text-red-400 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span>Gastos</span>
              </div>
              <p className="font-semibold text-white">{formatNumber(stats.totalSpent)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PointsDisplay;
