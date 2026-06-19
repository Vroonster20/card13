// src/components/game/DrawPile.tsx
'use client';
import { motion } from 'framer-motion';
import { CardBack } from './CardComponent';

interface DrawPileProps {
  count: number;
  canDraw: boolean;
  onDraw: () => void;
}

export function DrawPile({ count, canDraw, onDraw }: DrawPileProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      whileHover={canDraw ? { scale: 1.05 } : {}}
    >
      <button
        onClick={canDraw ? onDraw : undefined}
        disabled={!canDraw}
        className={`relative ${canDraw ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
      >
        {/* Stack effect */}
        <div className="absolute top-1 left-1 w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-blue-900 border-2 border-blue-700" />
        <div className="absolute top-0.5 left-0.5 w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-blue-850 border-2 border-blue-700" />
        <CardBack />
        {canDraw && (
          <div className="absolute inset-0 rounded-lg ring-2 ring-yellow-400 ring-offset-1 ring-offset-green-950 animate-pulse" />
        )}
      </button>
      <span className="text-xs text-green-300">{count} cards</span>
    </motion.div>
  );
}
