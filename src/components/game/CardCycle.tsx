'use client';

import { useEffect, useState } from 'react';
import { getCardImage } from '@/components/game/CardComponent';
import type { Card, Rank, Suit } from '@/types/game';

const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];

export default function CardCycle() {
  const [currentCard, setCurrentCard] = useState<Card>({
    id: '',
    rank: 'A',
    suit: 'spades',
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
      const randomSuit = suits[Math.floor(Math.random() * suits.length)];

      setCurrentCard({
        id: `${randomRank}-${randomSuit}`,
        rank: randomRank,
        suit: randomSuit,
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-center text-8xl animate-bounce animation-duration-[2s]">
      <img
        src={getCardImage(currentCard)}
        alt={`${currentCard.rank} of ${currentCard.suit}`}
        className="w-22 h-38 rounded-lg"
      />
    </div>
  );
}
