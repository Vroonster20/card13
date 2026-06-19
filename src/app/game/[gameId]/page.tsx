// ─────────────────────────────────────────────
// src/app/game/[gameId]/page.tsx
// ─────────────────────────────────────────────
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { GameBoard } from '@/components/game/GameBoard';

export default async function GamePage({ params }: { params: { gameId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return <GameBoard gameId={params.gameId} />;
}