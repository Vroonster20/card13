// src/components/game/CardComponent.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import type { Card, Rank } from '@/types/game';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface CardComponentProps {
  card: Card;
  isInGroup: boolean;
  canDiscard: boolean;
  onDiscard: (cardId: string) => void;
  wildRank: Rank;
  isDragging?: boolean;
}

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLOR: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black',
};

function getCardImage(card: Card): string {
  const rankMap: Record<Rank, string> = {
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    J: 'jack',
    Q: 'queen',
    K: 'king',
    A: 'ace',
  };

  return `/cards/${rankMap[card.rank]}_of_${card.suit}.svg`;
}

export function CardComponent({
  card,
  isInGroup,
  canDiscard,
  onDiscard,
  wildRank,
  isDragging = false,
}: CardComponentProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isWild = card.rank === wildRank;

  const handleClick = () => {
    if (canDiscard) {
      onDiscard(card.id);
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      whileHover={canDiscard ? { y: -8, scale: 1.05 } : { y: -4 }}
      whileTap={canDiscard ? { scale: 0.95 } : {}}
      className={cn(
        'relative select-none cursor-grab active:cursor-grabbing',
        'w-16 h-24 sm:w-20 sm:h-28',
        'rounded-lg shadow-lg',
        'flex flex-col items-start justify-between p-1',
        'transition-all duration-150',
        isSortDragging && 'opacity-30',
        isDragging && 'shadow-2xl cursor-grabbing rotate-3',
        isInGroup && 'border-green-400 shadow-green-400/30 shadow-lg ring-1 ring-green-400',
        !isInGroup && 'border-gray-200',
        isWild && 'border-purple-600 ring-3 ring-purple-500',
        canDiscard && !isSortDragging && 'cursor-pointer'
      )}
    >
      {/* Wild badge */}
      {isWild && (
        <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full z-10">
          WILD
        </div>
      )}

      {/* Top left rank + suit */}
      {/* <div className={cn('text-xs font-bold leading-none', SUIT_COLOR[card.suit])}>
        <div>{card.rank}</div>
        <div>{SUIT_SYMBOL[card.suit]}</div>
      </div> */}

      {/* Center suit symbol */}
      {/* <div className={cn('text-2xl self-center', SUIT_COLOR[card.suit])}>
        {SUIT_SYMBOL[card.suit]}
      </div> */}

      {/* Bottom right rank + suit (rotated) */}
      {/* <div className={cn('text-xs font-bold leading-none self-end rotate-180', SUIT_COLOR[card.suit])}>
        <div>{card.rank}</div>
        <div>{SUIT_SYMBOL[card.suit]}</div>
      </div> */}

      <Image
        src={getCardImage(card)}
        alt={`${card.rank} of ${card.suit}`}
        fill
        className="rounded-md pointer-events-none select-none "
        draggable={false}
      />

      {/* Discard indicator */}
      {canDiscard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-lg bg-red-500/10 pointer-events-none"
        />
      )}
    </motion.div>
  );
}

/** Card back face for draw pile and opponent hands */
export function CardBack({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-blue-700 bg-blue-800',
        'shadow-md flex items-center justify-center',
        className
      )}
      style={{
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 6px)',
      }}
    >
      <span className="text-blue-300 text-2xl">🂠</span>
    </div>
  );
}