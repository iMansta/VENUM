import { useState, useEffect } from 'react';
import { TrendingUp, Search, Filter, ArrowUpDown } from 'lucide-react';
import TopOpportunities from '@/components/market/TopOpportunities';
import AdvancedFilters from '@/components/market/filters/AdvancedFilters';
import TransportList from '@/components/market/TransportList';

/**
 * Market page - Market intelligence and arbitrage opportunities
 */

const Market = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading or check if data is ready
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-red-500" />
            Inteligência de Mercado
          </h1>
          <p className="text-gray-400 text-sm mt-1">Análise de arbitragem Albion Online</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Filter className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <AdvancedFilters onFilterChange={(filters) => console.log('Filters:', filters)} />
        </div>
      )}

      {/* Top Opportunities */}
      <div className="bg-slate-900 rounded-lg border border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-red-500" />
            Top Oportunidades
          </h2>
        </div>
        <div className="p-6">
          <TopOpportunities />
        </div>
      </div>

      {/* Transport List */}
      <div className="bg-slate-900 rounded-lg border border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-red-500" />
            Lista de Transporte
          </h2>
        </div>
        <div className="p-6">
          <TransportList />
        </div>
      </div>
    </div>
  );
};

export default Market;
