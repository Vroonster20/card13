// ─────────────────────────────────────────────
// src/components/game/GameEndOverlay.tsx
'use client';
import { motion } from 'framer-motion';
import { Trophy, Medal, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GameEndOverlayProps {
  finalScores: Record<string, number>;
  rankings: Array<{ userId: string; name: string; totalScore: number; rank: number }>;
  winner: string;
  myUserId: string;
  onClose: () => void;
}

export function GameEndOverlay({ rankings, winner, myUserId, onClose }: GameEndOverlayProps) {
  const iWon = winner === myUserId;

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <Star className="w-4 h-4 text-green-600" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.7, y: 60 }}
        animate={{ scale: 1, y: 0, transition: { type: 'spring', bounce: 0.3 } }}
        className="bg-gradient-to-b from-green-900 to-green-950 border border-green-600 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
      >
        <div className="text-center mb-6">
          {iWon ? (
            <>
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-3xl font-bold text-yellow-400">You Win!</h2>
              <p className="text-green-300 mt-1">Lowest score takes it all</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-2">🎴</div>
              <h2 className="text-3xl font-bold text-white">Game Over</h2>
              <p className="text-green-400 mt-1">{rankings[0]?.name} wins!</p>
            </>
          )}
        </div>

        <div className="space-y-2 mb-6">
          {rankings.map(r => (
            <div
              key={r.userId}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                r.userId === myUserId ? 'bg-green-700 border border-green-500' : 'bg-green-900/60'
              }`}
            >
              {rankIcon(r.rank)}
              <span className={`flex-1 text-sm ${r.userId === myUserId ? 'font-semibold text-white' : 'text-green-200'}`}>
                {r.name}
                {r.userId === myUserId && ' (You)'}
              </span>
              <span className="font-mono text-sm text-yellow-400">{r.totalScore} pts</span>
            </div>
          ))}
        </div>

        <Button onClick={onClose} className="w-full bg-green-600 hover:bg-green-500 text-white">
          Back to Dashboard
        </Button>
      </motion.div>
    </motion.div>
  );
}