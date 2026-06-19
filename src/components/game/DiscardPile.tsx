// ─────────────────────────────────────────────
// src/components/game/DiscardPile.tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { CardComponent } from './CardComponent';
import type { Card, Rank } from '@/types/game';

interface DiscardPileProps {
  topCard: Card | null;
  canDraw: boolean;
  onDraw: () => void;
}

export function DiscardPile({ topCard, canDraw, onDraw }: DiscardPileProps) {
  return (
    <motion.div className="flex flex-col items-center gap-2">
      <button
        onClick={canDraw && topCard ? onDraw : undefined}
        disabled={!canDraw || !topCard}
        className={`relative ${canDraw && topCard ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <AnimatePresence mode="popLayout">
          {topCard ? (
            <motion.div
              key={topCard.id}
              initial={{ opacity: 0, y: -20, rotateZ: -5 }}
              animate={{ opacity: 1, y: 0, rotateZ: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <CardComponent
                card={topCard}
                isInGroup={false}
                canDiscard={false}
                onDiscard={() => {}}
                wildRank={'3'}
              />
            </motion.div>
          ) : (
            <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 border-dashed border-green-700 flex items-center justify-center">
              <span className="text-green-700 text-xs text-center">Discard<br/>Pile</span>
            </div>
          )}
        </AnimatePresence>
        {canDraw && topCard && (
          <div className="absolute inset-0 rounded-lg ring-2 ring-yellow-400 ring-offset-1 ring-offset-green-950 animate-pulse" />
        )}
      </button>
      <span className="text-xs text-green-300">Discard</span>
    </motion.div>
  );
}