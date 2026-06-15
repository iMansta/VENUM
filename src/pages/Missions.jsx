import MissionList from '@/components/guild/missions/MissionList';

/**
 * Missions page - Display and manage guild missions
 */

const Missions = ({ userId, userRole }) => {
  return <MissionList userId={userId} userRole={userRole} />;
};

export default Missions;
