import { useState, useEffect } from 'react';
import { Store, Award, Package } from 'lucide-react';
import { getProfile } from '@/lib/supabase/profiles';
import { getUserPointsStats } from '@/lib/supabase/points';
import PointsDisplay from './PointsDisplay';
import ShopGrid from './ShopGrid';
import PurchaseModal from './PurchaseModal';

/**
 * GuildShop component - Main shop interface with points display
 */

const GuildShop = ({ userId }) => {
  const [profile, setProfile] = useState(null);
  const [pointsStats, setPointsStats] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
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
