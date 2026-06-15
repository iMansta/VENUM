import { useTransportStore } from '@/store/transportStore';
import { Trash2, Plus, Package, TrendingUp, X } from 'lucide-react';

const TransportList = () => {
  const {
    routes,
    removeRoute,
    updateRouteQuantity,
    clearAllRoutes,
    getTotalProfit,
    getTotalQuantity,
  } = useTransportStore();

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const handleQuantityChange = (id, newQuantity) => {
    const quantity = Math.max(1, parseInt(newQuantity) || 1);
    updateRouteQuantity(id, quantity);
  };

  const handleRemoveRoute = (id) => {
    if (window.confirm('Tem certeza que deseja remover esta rota?')) {
      removeRoute(id);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Tem certeza que deseja limpar todas as rotas?')) {
      clearAllRoutes();
    }
  };

  if (routes.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Nenhuma Rota de Transporte
          </h3>
          <p className="text-gray-500">
            Selecione itens na tabela de arbitragem para adicionar às suas rotas de transporte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-white">Minhas Rotas de Transporte</h2>
            <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
              {routes.length} rotas
            </span>
          </div>
          <button
            onClick={handleClearAll}
            className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Tudo
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400 text-sm">Total de Itens</span>
          </div>
          <p className="text-2xl font-bold text-white">{getTotalQuantity()}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-gray-400 text-sm">Lucro Total Estimado</span>
          </div>
          <p className="text-2xl font-bold text-green-400">
            {formatSilver(getTotalProfit())}
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Plus className="w-5 h-5 text-amber-400" />
            <span className="text-gray-400 text-sm">Lucro Médio por Rota</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {formatSilver(getTotalProfit() / routes.length || 0)}
          </p>
        </div>
      </div>

      {/* Routes Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Item
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Rota
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Compra
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Venda
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Qtd
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Lucro/Un
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Lucro Total
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Margem
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {routes.map((route) => (
              <tr key={route.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-white">{route.itemName}</div>
                  <div className="text-xs text-gray-500">{route.itemId}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">{route.fromCity}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-amber-400">{route.toCity}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-white">{formatSilver(route.buyPrice)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-white">{formatSilver(route.sellPrice)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <input
                    type="number"
                    value={route.quantity}
                    onChange={(e) => handleQuantityChange(route.id, e.target.value)}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    min="1"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={route.netProfit > 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatSilver(route.netProfit)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="font-medium text-green-400">
                    {formatSilver(route.netProfit * route.quantity)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span
                    className={`font-medium ${
                      route.margin >= 20 ? 'text-green-400' : 'text-gray-300'
                    }`}
                  >
                    {route.margin.toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => handleRemoveRoute(route.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                    title="Remover rota"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-slate-800/30 px-6 py-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Última atualização: {new Date().toLocaleString('pt-BR')}
          </span>
          <span>
            Dados salvos automaticamente no navegador
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransportList;
