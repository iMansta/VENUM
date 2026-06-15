import { useState, useEffect } from 'react';
import MissionList from '@/components/guild/missions/MissionList';

/**
 * Missions page - Display and manage guild missions
 */

const Missions = ({ userId, userRole }) => {
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

  return <MissionList userId={userId} userRole={userRole} />;
};

export default Missions;
