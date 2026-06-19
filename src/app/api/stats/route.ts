// src/app/api/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [stats, matchHistory] = await Promise.all([
    prisma.userStatistics.findUnique({ where: { userId } }),
    prisma.matchHistory.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      take: 20,
      include: { game: { include: { players: { include: { user: true } } } } },
    }),
  ]);

  const gamesPlayed = stats?.gamesPlayed ?? 0;
  const gamesWon = stats?.gamesWon ?? 0;
  const winPercentage = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const averageScore =
    gamesPlayed > 0 ? Math.round((stats?.totalScore ?? 0) / gamesPlayed) : 0;

  return NextResponse.json({
    stats: {
      gamesPlayed,
      gamesWon,
      winPercentage,
      averageScore,
      lowestScore: stats?.lowestScore ?? null,
      highestScore: stats?.highestScore ?? null,
      currentStreak: stats?.currentStreak ?? 0,
      longestStreak: stats?.longestStreak ?? 0,
    },
    matchHistory: matchHistory.map(m => ({
      id: m.id,
      gameId: m.gameId,
      finalScore: m.finalScore,
      finalRank: m.finalRank,
      playerCount: m.playerCount,
      playedAt: m.playedAt,
    })),
  });
}