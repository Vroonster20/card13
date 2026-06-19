// ─────────────────────────────────────────────
// src/components/game/RoundEndOverlay.tsx
'use client';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import type { ClientPlayer } from '@/types/game';

interface RoundEndOverlayProps {
  scores: Record<string, number>;
  nextRound: number | null;
  players: ClientPlayer[];
  cumulativeScores: Record<string, number>;
}

export function RoundEndOverlay({ scores, nextRound, players, cumulativeScores }: RoundEndOverlayProps) {
  const { clearRoundEnded } = useGameStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 40 }}
        className="bg-green-900 border border-green-600 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
      >
        <h2 className="text-2xl font-bold text-white text-center mb-1">
          Round Over!
        </h2>
        <p className="text-green-400 text-center text-sm mb-4">
          {nextRound ? `Next: Round ${nextRound} of 11` : 'Final round complete!'}
        </p>

        <div className="space-y-2 mb-4">
          {players
            .sort((a, b) => (scores[a.userId] ?? 0) - (scores[b.userId] ?? 0))
            .map(p => (
              <div key={p.userId} className="flex items-center justify-between bg-green-800 rounded-lg px-3 py-2">
                <span className="text-sm text-white">{p.name}</span>
                <div className="flex gap-3">
                  <span className="text-sm text-red-300">+{scores[p.userId] ?? 0}</span>
                  <span className="text-sm text-yellow-400 font-mono">{cumulativeScores[p.userId] ?? 0} total</span>
                </div>
              </div>
            ))}
        </div>

        <p className="text-xs text-green-500 text-center">
          {nextRound ? 'Next round starting in a moment...' : 'Calculating final scores...'}
        </p>
      </motion.div>
    </motion.div>
  );
}