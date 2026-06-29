import { useState, useEffect } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';

const Ranking = ({ userId }) => {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch real ranking from Supabase
    const mockRanking = [
      { rank: 1, username: 'DragonSlayer', points: 45000, avatar: 'D' },
      { rank: 2, username: 'ShadowKnight', points: 42000, avatar: 'S' },
      { rank: 3, username: 'IceMage', points: 38000, avatar: 'I' },
      { rank: 4, username: 'FireWarrior', points: 35000, avatar: 'F' },
      { rank: 5, username: 'StormArcher', points: 32000, avatar: 'S' },
      { rank: 6, username: 'LightCleric', points: 29000, avatar: 'L' },
      { rank: 7, username: 'DarkRogue', points: 27000, avatar: 'D' },
      { rank: 8, username: 'NatureDruid', points: 25000, avatar: 'N' },
      { rank: 9, username: 'SteelGuard', points: 23000, avatar: 'S' },
      { rank: 10, username: 'ThunderMage', points: 21000, avatar: 'T' },
    ];
    setRanking(mockRanking);
    setLoading(false);
  }, [userId]);

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-amber-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-700" />;
    return <span className="text-sm font-bold text-gray-400">#{rank}</span>;
  };

  const getRankClass = (rank) => {
    if (rank === 1) return 'bg-amber-500/10 border-amber-500/50';
    if (rank === 2) return 'bg-gray-500/10 border-gray-500/50';
    if (rank === 3) return 'bg-amber-700/10 border-amber-700/50';
    return 'bg-slate-800/50 border-slate-700';
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Ranking da Guilda</h1>
        <p className="text-gray-400 mt-1">Classificação dos membros por pontos</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 bg-slate-800 border-b border-slate-700 text-sm font-semibold text-gray-400">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Membro</div>
            <div className="col-span-3 text-right">Pontos</div>
            <div className="col-span-3 text-right">Status</div>
          </div>

          <div className="divide-y divide-slate-800">
            {ranking.map((member) => (
              <div
                key={member.rank}
                className={`grid grid-cols-12 gap-4 p-4 items-center ${getRankClass(member.rank)} border border-transparent`}
              >
                <div className="col-span-1 flex items-center justify-center">
                  {getRankIcon(member.rank)}
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">{member.avatar}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{member.username}</span>
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-sm font-semibold text-white">{member.points.toLocaleString()}</span>
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                    Ativo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Ranking;
