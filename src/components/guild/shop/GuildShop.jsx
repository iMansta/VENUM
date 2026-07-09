import { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { getProfile } from '@/lib/supabase/profiles';
import { getUserPointsStats } from '@/lib/supabase/points';
import { getUserPurchases } from '@/lib/supabase/shop';
import PointsDisplay from './PointsDisplay';
import ShopGrid from './ShopGrid';
import PurchaseModal from './PurchaseModal';

const PURCHASE_STATUS = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  approved: { label: 'Aprovado', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  delivered: { label: 'Entregue', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

/**
 * GuildShop component - Main shop interface with points display
 */

const GuildShop = ({ userId }) => {
  const [profile, setProfile] = useState(null);
  const [pointsStats, setPointsStats] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    setLoading(true);
    
    // Load profile
    const { success: profileSuccess, data: userProfile } = await getProfile(userId);
    if (profileSuccess) {
      setProfile(userProfile);
    }

    // Load points stats
    const { success: statsSuccess, data: stats } = await getUserPointsStats(userId);
    if (statsSuccess) {
      setPointsStats(stats);
    }

    // Load purchase history
    const { success: purchasesSuccess, data: purchaseRows } = await getUserPurchases(userId, 30);
    if (purchasesSuccess) {
      setPurchases(purchaseRows || []);
    }

    setLoading(false);
  };

  const handlePurchaseSuccess = (item) => {
    // Reload user data after purchase
    loadUserData();
    setSelectedItem(null);
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando loja...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Points Display */}
      <PointsDisplay points={profile?.total_points || 0} stats={pointsStats} />

      {/* Shop Grid */}
      <ShopGrid
        userPoints={profile?.total_points || 0}
        userId={userId}
        onPurchaseSuccess={handlePurchaseSuccess}
      />

      {/* Minhas Compras (histórico do membro) */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          Minhas Compras
        </h2>
        {purchases.length === 0 ? (
          <p className="text-sm text-gray-500">
            Você ainda não resgatou itens. Suas compras aparecerão aqui.
          </p>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) => {
              const st = PURCHASE_STATUS[p.status] || PURCHASE_STATUS.pending;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      {p.shop_items?.name || 'Item'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.points_spent} pts ·{' '}
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : ''}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${st.color}`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      {selectedItem && (
        <PurchaseModal
          item={selectedItem}
          userPoints={profile?.total_points || 0}
          onConfirm={handlePurchaseSuccess}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default GuildShop;
