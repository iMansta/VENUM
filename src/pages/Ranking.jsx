import { useState, useEffect } from 'react';
import RankingDisplay from '@/components/guild/ranking/RankingDisplay';

/**
 * Ranking page - Display weekly and monthly rankings
 */

const Ranking = ({ userId }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading or check if data is ready
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <RankingDisplay userId={userId} />;
};

export default Ranking;
