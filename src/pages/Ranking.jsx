import RankingDisplay from '@/components/guild/ranking/RankingDisplay';

/**
 * Ranking page - Display weekly and monthly rankings
 */

const Ranking = ({ userId }) => {
  return <RankingDisplay userId={userId} />;
};

export default Ranking;
