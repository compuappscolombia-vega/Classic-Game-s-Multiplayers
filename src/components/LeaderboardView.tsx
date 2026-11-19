import { useEffect, useState } from 'react';
import { Trophy, History, LogIn } from 'lucide-react';
import {
  subscribeToLeaderboard,
  subscribeToMatchHistory,
  type LeaderboardEntry,
  type MatchHistoryRecord,
  type UserProfile,
} from '../lib/firebase.ts';
import type { GameType } from '../shared/types.ts';

interface LeaderboardViewProps {
  profile: UserProfile | null;
  onOpenAuth: () => void;
}

const GAME_NAME: Record<GameType, string> = {
  domino: 'Dominó',
  parques: 'Parqués',
  ahorcado: 'Ahorcado',
  bingo: 'Bingo',
};

export function LeaderboardView({ profile, onOpenAuth }: LeaderboardViewProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<MatchHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) {
      setEntries([]);
      setHistory([]);
      return;
    }
    setLoading(true);
    const unsubLb = subscribeToLeaderboard((rows) => {
      setEntries(rows);
      setLoading(false);
    });
    const unsubHist = subscribeToMatchHistory(profile.uid, (recs) => {
      setHistory(recs);
    });
    return () => {
      unsubLb();
      unsubHist();
    };
  }, [profile]);

  if (!profile) {
    return (
      <div className="bg-[#141b18] border border-white/10 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-4">
        <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-xl font-bold text-[#f4f1ea]">Global Competitive Rankings</h3>
        <p className="text-sm text-stone-400 leading-relaxed">
          Sign in with your Google account or Apple ID to synchronize your ELO rating across mobile and desktop, view live global standings, and archive your match history.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          Sign In to Sync Rankings
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 8 cols: Global Standings */}
      <div className="lg:col-span-8 bg-[#141b18] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#f4f1ea]">Global Salon Leaderboard</h3>
            <p className="text-xs text-stone-400">Live ELO standings synchronized via Firestore</p>
          </div>
          <span className="text-xs text-amber-300 font-mono-num">Your ELO: {profile.elo}</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-stone-400">Loading standings...</div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone-400">
            No ranked entries yet. Complete a match to claim the #1 spot!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-stone-400">
                  <th className="py-2.5 pr-3 font-medium">Rank</th>
                  <th className="py-2.5 px-3 font-medium">Player</th>
                  <th className="py-2.5 px-3 font-medium">Favorite</th>
                  <th className="py-2.5 px-3 font-medium text-right">Wins</th>
                  <th className="py-2.5 px-3 font-medium text-right">Streak</th>
                  <th className="py-2.5 pl-3 font-medium text-right">ELO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-sm">
                {entries.map((row, index) => {
                  const isSelf = row.uid === profile.uid;
                  return (
                    <tr
                      key={row.uid}
                      className={isSelf ? 'bg-emerald-500/10' : 'hover:bg-white/[0.02]'}
                    >
                      <td className="py-3 pr-3 font-mono-num text-stone-300">
                        #{index + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {row.photoURL ? (
                            <img
                              src={row.photoURL}
                              alt={row.displayName}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-emerald-700/50 flex items-center justify-center text-xs font-bold">
                              {row.displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-[#f4f1ea] truncate max-w-[160px]">
                            {row.displayName}
                            {isSelf ? ' (You)' : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-stone-300">
                        {GAME_NAME[row.favoriteGame]}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-stone-300">
                        {row.totalWins}/{row.totalGames}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-amber-300">
                        {row.winStreak}
                      </td>
                      <td className="py-3 pl-3 text-right font-mono-num font-bold text-emerald-300">
                        {row.elo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right 4 cols: Personal Synced Match History */}
      <div className="lg:col-span-4 bg-[#141b18] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <h3 className="text-base font-bold text-[#f4f1ea]">Recent Match Log</h3>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-stone-400 py-6 text-center">
            Your synced online and AI practice results will appear here.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {history.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-[#0e1412] border border-white/8 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs text-stone-400">
                    {GAME_NAME[m.game]} · {m.mode === 'online' ? 'Online' : 'AI Practice'}
                  </div>
                  <div
                    className={`text-sm font-semibold capitalize mt-0.5 ${
                      m.outcome === 'win'
                        ? 'text-emerald-400'
                        : m.outcome === 'loss'
                        ? 'text-rose-400'
                        : 'text-amber-300'
                    }`}
                  >
                    {m.outcome}
                  </div>
                </div>
                <div className="text-right font-mono-num">
                  <div
                    className={`text-xs font-bold ${
                      m.eloDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {m.eloDelta >= 0 ? `+${m.eloDelta}` : m.eloDelta} ELO
                  </div>
                  <div className="text-[11px] text-stone-500">{m.score} pts</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
