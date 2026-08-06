// ─────────────────────────────────────────────
// src/components/game/TurnIndicator.tsx
'use client';
import type { ClientPlayer } from '@/types/game';

interface TurnIndicatorProps {
  players: ClientPlayer[];
  currentTurnUserId: string;
  myUserId: string;
}

export function TurnIndicator({ players, currentTurnUserId, myUserId }: TurnIndicatorProps) {
  const currentPlayer = players.find(p => p.userId === currentTurnUserId);
  const isMyTurn = currentTurnUserId === myUserId;

  return (
    <div className={`text-center px-3 py-1 rounded-full text-sm font-medium ${
      isMyTurn ? 'bg-yellow-500 text-black' : 'bg-green-800 text-green-200'
    }`}>
      {isMyTurn ? '🎯 Your Turn!' : `${currentPlayer?.name ?? '...'}'s turn`}
    </div>
  );
}