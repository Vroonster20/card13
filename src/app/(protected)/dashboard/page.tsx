// ─────────────────────────────────────────────
// src/app/(protected)/dashboard/page.tsx
// ─────────────────────────────────────────────
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/shared/SignOutButton';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const isGuest = session.user.isGuest;

  const userId = session.user.id;
  const stats = await prisma.userStatistics.findUnique({ where: { userId } });
  const recentGames = await prisma.matchHistory.findMany({
    where: { userId },
    orderBy: { playedAt: 'desc' },
    take: 5,
  });

  const winPct = stats?.gamesPlayed
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-white">Welcome, {session.user.name}! 👋</h1>
          <SignOutButton />
        </div>
        <div className="flex items-center justify-between mb-8">
          <p className="text-green-400 mt-1">Ready to play a round?</p>
        </div>

        {isGuest ? (
          <div className="rounded-xl border border-yellow-600 bg-yellow-900/20 p-6 text-center mb-6">
            <h2 className="text-xl font-semibold">Playing as Guest</h2>
            <p className="text-yellow-300 mt-2">
              Guest accounts don't save statistics or match history.
            </p><br />
            <Button asChild size="lg" className="bg-green-600 hover:bg-green-500 text-white h-14 text-base">
              <Link href="/lobby">🎮 Create / Join Game</Link>
            </Button>
          </div>
        ) : (
          <>
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Games', value: stats?.gamesPlayed ?? 0 },
            { label: 'Wins', value: stats?.gamesWon ?? 0 },
            { label: 'Win %', value: `${winPct}%` },
            { label: 'Best', value: stats?.lowestScore ?? '—' },
          ].map(s => (
            <div key={s.label} className="bg-green-900/60 border border-green-700 rounded-xl p-4 text-center backdrop-blur">
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-green-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Button asChild size="lg" className="bg-green-600 hover:bg-green-500 text-white h-14 text-base">
            <Link href="/lobby">🎮 Create / Join Game</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-green-600 text-green-300 hover:bg-green-800 h-14 text-base">
            <Link href="/stats">📊 Full Statistics</Link>
          </Button>
        </div>

        {/* Recent Games */}
        {recentGames.length > 0 && (
          <div className="bg-green-900/60 border border-green-700 rounded-2xl p-5 backdrop-blur">
            <h2 className="text-sm font-semibold text-green-300 uppercase tracking-wide mb-3">Recent Games</h2>
            <div className="space-y-2">
              {recentGames.map(game => (
                <div key={game.id} className="flex items-center justify-between bg-green-800/50 rounded-xl px-4 py-3">
                  <div>
                    <div className="text-sm text-white">
                      {game.finalRank === 1 ? '🏆' : `#${game.finalRank}`} vs {game.playerCount - 1} players
                    </div>
                    <div className="text-xs text-green-500">
                      {new Date(game.playedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-yellow-400">{game.finalScore} pts</div>
                    <div className={`text-xs ${game.finalRank === 1 ? 'text-green-400' : 'text-gray-500'}`}>
                      {game.finalRank === 1 ? 'Win' : 'Loss'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}