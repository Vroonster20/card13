// ─────────────────────────────────────────────
// src/components/game/WildCardDisplay.tsx
'use client';
import type { Rank } from '@/types/game';
import { Badge } from '@/components/ui/badge';

export function WildCardDisplay({ wildRank, roundNumber }: { wildRank: Rank; roundNumber: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-green-400">Round {roundNumber}/11</span>
      <Badge className="bg-purple-700 hover:bg-purple-700 text-white text-xs">
        Wild: {wildRank}s
      </Badge>
    </div>
  );
}