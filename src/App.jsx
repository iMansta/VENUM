import { useState, useEffect } from 'react';
import { useAlbionData } from './hooks/useAlbionData';
import { RefreshCw, Search, Check, TrendingUp, AlertCircle, Coins } from 'lucide-react';

function App() {
  const { data, loading, error, lastUpdate, fetchData, calculateArbitrage, formatSilver } = useAlbionData();
  
  const [taxRate, setTaxRate] = useState(4);
  const [transportCost, setTransportCost] = useState(500);
  const [profitTarget, setProfitTarget] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [arbitrageData, setArbitrageData] = useState([]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    const calculated = calculateArbitrage(taxRate, transportCost);
    setArbitrageData(calculated);
  }, [data, taxRate, transportCost, calculateArbitrage]);

  const handleUpdate = () => {
    if (cooldown === 0) {
      fetchData();
      setCooldown(60);
    }
  };

  const filteredData = arbitrageData.filter(item =>
    item.itemId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const profitableItems = filteredData.filter(item => item.margin >= profitTarget);

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-amber-500 mb-2 flex items-center gap-3">
            <Coins className="w-10 h-10" />
            Black Market Arbitrage Dashboard
          </h1>
          <p className="text-gray-400">Caerleon Market Analysis - Albion Online</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-500 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="font-semibold text-red-400">Erro na API</p>
              <p className="text-sm text-gray-300">{error}. Usando dados em cache ou mock.</p>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="bg-slate-900 rounded-lg p-6 mb-6 border border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Taxa de Imposto (%)
              </label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                min="0"
                max="100"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Custo de Transporte (Prata)
              </label>
              <input
                type="number"
                value={transportCost}
                onChange={(e) => setTransportCost(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                min="0"
                step="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Meta de Lucro (%)
              </label>
              <input
                type="number"
                value={profitTarget}
                onChange={(e) => setProfitTarget(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                min="0"
                max="100"
                step="1"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleUpdate}
                disabled={cooldown > 0 || loading}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? `${cooldown}s` : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <span className="text-gray-400 font-medium">Oportunidades</span>
            </div>
            <p className="text-3xl font-bold text-green-400">{profitableItems.length}</p>
            <p className="text-sm text-gray-500">Itens acima da meta de lucro</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-6 h-6 text-amber-400" />
              <span className="text-gray-400 font-medium">Total Analisado</span>
            </div>
            <p className="text-3xl font-bold text-amber-400">{filteredData.length}</p>
            <p className="text-sm text-gray-500">Itens monitorados</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <RefreshCw className="w-6 h-6 text-blue-400" />
              <span className="text-gray-400 font-medium">Última Atualização</span>
            </div>
            <p className="text-lg font-bold text-blue-400">
              {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('pt-BR') : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {lastUpdate ? new Date(lastUpdate).toLocaleDateString('pt-BR') : ''}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Preço BM (Caerleon)
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Menor Preço (Cidade)
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Lucro Líquido
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Margem %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => {
                    const isProfitable = item.margin >= profitTarget;
                    return (
                      <tr
                        key={`${item.itemId}-${index}`}
                        className={`hover:bg-slate-800/50 transition-colors ${
                          isProfitable ? 'bg-green-900/20 shadow-lg shadow-green-500/10' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {isProfitable && <Check className="w-5 h-5 text-green-400" />}
                            <span className={`font-medium ${isProfitable ? 'text-green-300' : 'text-white'}`}>
                              {item.itemId}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-amber-400 font-medium">
                            {formatSilver(item.bmPrice)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div>
                            <span className="text-white">{formatSilver(item.lowestPrice)}</span>
                            <span className="text-gray-500 text-sm ml-2">({item.lowestCity})</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`font-medium ${item.netProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatSilver(item.netProfit)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`font-medium ${item.margin >= profitTarget ? 'text-green-400' : 'text-gray-300'}`}>
                            {item.margin.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>Dados fornecidos por albion-online-data.com | Black Market de Caerleon</p>
        </div>
      </div>
    </div>
  );
}

export default App;
