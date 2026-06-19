// ─────────────────────────────────────────────
// src/components/game/ScoreBoard.tsx
'use client';
import { useState } from 'react';
import type { ClientPlayer } from '@/types/game';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

interface ScoreBoardProps {
  players: ClientPlayer[];
  scores: Record<string, number>;
}

export function ScoreBoard({ players, scores }: ScoreBoardProps) {
  const [open, setOpen] = useState(false);

  const sorted = [...players].sort((a, b) => (scores[a.userId] ?? 0) - (scores[b.userId] ?? 0));

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(o => !o)}
        className="text-green-300 hover:text-white hover:bg-green-800"
      >
        <BarChart3 className="w-4 h-4 mr-1" />
        Scores
      </Button>

      {open && (
        <div className="absolute right-0 top-10 bg-green-900 border border-green-700 rounded-xl p-3 z-50 shadow-2xl min-w-48">
          <h3 className="text-xs font-semibold text-green-300 mb-2 uppercase tracking-wide">Standings</h3>
          {sorted.map((p, idx) => (
            <div key={p.userId} className="flex items-center justify-between py-1 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-500 w-4">{idx + 1}.</span>
                <span className="text-sm text-white truncate max-w-28">{p.name}</span>
              </div>
              <span className="text-sm font-mono text-yellow-400">{scores[p.userId] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}