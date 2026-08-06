// ─────────────────────────────────────────────
// src/app/(protected)/stats/page.tsx
// ─────────────────────────────────────────────
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [stats, matchHistory] = await Promise.all([
    prisma.userStatistics.findUnique({ where: { userId: session.user.id } }),
    prisma.matchHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { playedAt: 'desc' },
      take: 20,
    }),
  ]);

  const gamesPlayed = stats?.gamesPlayed ?? 0;
  const gamesWon = stats?.gamesWon ?? 0;
  const winPercentage = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const averageScore =
    gamesPlayed > 0 ? Math.round((stats?.totalScore ?? 0) / gamesPlayed) : 0;


  const statCards = [
    { label: 'Games Played', value: stats?.gamesPlayed ?? 0, icon: '🎮' },
    { label: 'Games Won', value: stats?.gamesWon ?? 0, icon: '🏆' },
    { label: 'Win Rate', value: `${winPercentage ?? 0}%`, icon: '📈' },
    { label: 'Avg Score', value: averageScore ?? '—', icon: '📊' },
    { label: 'Best Score', value: stats?.lowestScore ?? '—', icon: '⭐' },
    { label: 'Worst Score', value: stats?.highestScore ?? '—', icon: '😅' },
    { label: 'Win Streak', value: stats?.currentStreak ?? 0, icon: '🔥' },
    { label: 'Best Streak', value: stats?.longestStreak ?? 0, icon: '💪' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-green-400 hover:text-white">←</Link>
          <h1 className="text-3xl font-bold text-white">Statistics</h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {statCards.map(s => (
            <div key={s.label} className="bg-green-900/60 border border-green-700 rounded-xl p-4 text-center backdrop-blur">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-green-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-green-900/60 border border-green-700 rounded-2xl p-5 backdrop-blur">
          <h2 className="text-sm font-semibold text-green-300 uppercase tracking-wide mb-3">Match History</h2>
          {matchHistory.length === 0 ? (
            <p className="text-green-600 text-sm text-center py-4">No games played yet</p>
          ) : (
            <div className="space-y-2">
              {matchHistory.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between bg-green-800/50 rounded-xl px-4 py-3">
                  <div>
                    <div className="text-sm text-white">
                      {m.finalRank === 1 ? '🏆 Win' : `#${m.finalRank} of ${m.playerCount}`}
                    </div>
                    <div className="text-xs text-green-500">
                      {new Date(m.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="font-mono text-yellow-400 text-sm">{m.finalScore} pts</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}