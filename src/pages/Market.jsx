import { useState, useEffect } from 'react';
import { TrendingUp, Search, Filter, ArrowUpDown, RefreshCw } from 'lucide-react';
import TopOpportunities from '@/components/market/TopOpportunities';
import AdvancedFilters from '@/components/market/filters/AdvancedFilters';
import TransportList from '@/components/market/TransportList';
import { useMarketOpportunities } from '@/hooks/useMarketOpportunities';

/**
 * Market page - Market intelligence and arbitrage opportunities
 */

const Market = ({ userId }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transportFilters, setTransportFilters] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Single source of truth for market opportunities
  const {
    opportunities,
    loading: opportunitiesLoading,
    refresh: refreshOpportunities,
    progress,
    hasMoreTiers,
    loadAllTiers,
  } = useMarketOpportunities(50, refreshKey);

  const progressText = progress.total > 0
    ? `Carregando ${Math.min(progress.loaded, progress.total)} de ${progress.total} itens...`
    : 'Preparando consulta de mercado...';

  useEffect(() => {
    // Simulate loading or check if data is ready
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleFilterChange = (filters) => {
    setTransportFilters(filters);
  };

  const handleApplyFilters = () => {
    // Trigger refresh with current filters
    setRefreshKey(prev => prev + 1);
  };

  const handleRefresh = () => {
    refreshOpportunities({ includeAllTiers: false });
  };

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
        <div className="flex items-center gap-2">
          {hasMoreTiers && (
            <button
              onClick={loadAllTiers}
              disabled={opportunitiesLoading}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-gray-500 text-slate-950 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Search className="w-5 h-5" />
              Carregar T6-T8
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={opportunitiesLoading}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Atualizar
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Filter className="w-5 h-5" />
            Filtros
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <AdvancedFilters onFilterChange={handleFilterChange} onApplyFilters={handleApplyFilters} />
        </div>
      )}

      {/* Top Opportunities */}
      <div className="bg-slate-900 rounded-lg border border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-red-500" />
            Top Oportunidades
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {opportunitiesLoading ? progressText : 'Melhores oportunidades de arbitragem (carregamento inicial T4-T5)'}
          </p>
        </div>
        <div className="p-6">
          <TopOpportunities
            arbitrageData={opportunities}
            limit={10}
            loading={opportunitiesLoading}
            loadingProgress={progress}
          />
        </div>
      </div>

      {/* Transport List */}
      <div className="bg-slate-900 rounded-lg border border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-red-500" />
            Lista de Transporte
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {opportunitiesLoading ? progressText : 'Oportunidades de transporte (com filtro)'}
          </p>
        </div>
        <div className="p-6">
          <TransportList 
            userId={userId} 
            filters={transportFilters} 
            refreshKey={refreshKey}
            opportunities={opportunities}
            loading={opportunitiesLoading}
            loadingProgress={progress}
          />
        </div>
      </div>
    </div>
  );
};

export default Market;
