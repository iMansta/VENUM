import { useState, useEffect } from 'react';
import { Trash2, Plus, Package, TrendingUp, X, Lock, Unlock } from 'lucide-react';
import { getAvailableTransports, reserveTransport, cancelTransportReservation } from '@/lib/supabase/transports';

const TransportList = ({ userId }) => {
  const [transports, setTransports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState(null);

  useEffect(() => {
    loadTransports();
  }, []);

  const loadTransports = async () => {
    setLoading(true);
    const { success, data } = await getAvailableTransports();
    if (success) {
      setTransports(data);
    }
    setLoading(false);
  };

  const handleReserve = async (transportId) => {
    if (!userId) {
      alert('Você precisa estar logado para reservar um transporte');
      return;
    }

    setReservingId(transportId);
    const { success } = await reserveTransport(transportId, userId);
    
    if (success) {
      // Reload transports to remove the reserved one
      loadTransports();
    } else {
      alert('Falha ao reservar transporte. Tente novamente.');
    }
    
    setReservingId(null);
  };

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando transportes...</p>
        </div>
      </div>
    );
  }

  if (transports.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Nenhuma Oportunidade de Transporte
          </h3>
          <p className="text-gray-500">
            Aguarde novas oportunidades de transporte aparecerem.
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
            <h2 className="text-xl font-bold text-white">Oportunidades de Transporte</h2>
            <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
              {transports.length} disponíveis
            </span>
          </div>
        </div>
      </div>

      {/* Transport Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {transports.map((transport) => (
            <div
              key={transport.id}
              className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 transition-all"
            >
              {/* Item Info */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{transport.item_name || transport.item_id}</h3>
                  <p className="text-xs text-gray-500">{transport.item_id}</p>
                </div>
              </div>

              {/* Route */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <span className="text-blue-400 font-medium">{transport.from_city}</span>
                <span className="text-gray-500">→</span>
                <span className="text-amber-400 font-medium">{transport.to_city}</span>
              </div>

              {/* Price Details */}
              <div className="space-y-2 mb-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Compra:</span>
                  <span className="text-white">{formatSilver(transport.buy_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Venda:</span>
                  <span className="text-white">{formatSilver(transport.sell_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Lucro:</span>
                  <span className="text-green-400 font-medium">{formatSilver(transport.profit)}</span>
                </div>
              </div>

              {/* Reserve Button */}
              <button
                onClick={() => handleReserve(transport.id)}
                disabled={reservingId === transport.id}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-gray-500 text-slate-950 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {reservingId === transport.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Reservando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Reservar
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-800/30 px-6 py-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Última atualização: {new Date().toLocaleString('pt-BR')}
          </span>
          <span>
            Itens reservados ficam bloqueados para outros usuários
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransportList;
