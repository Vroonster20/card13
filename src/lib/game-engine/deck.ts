// src/lib/game-engine/deck.ts
// Two-deck card generation and shuffle

import { v4 as uuidv4 } from 'uuid';
import type { Card, Rank, Suit } from '@/types/game';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Create one standard 52-card deck */
function createDeck(deckIndex: number): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${suit}-${rank}-d${deckIndex}-${uuidv4().slice(0, 8)}`,
        suit,
        rank,
      });
    }
  }
  return cards;
}

/** Fisher-Yates shuffle */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Create shuffled double deck (104 cards) */
export function createShuffledDoubleDeck(): Card[] {
  return shuffle([...createDeck(0), ...createDeck(1)]);
}

/** Get the wild rank for a given round (1-indexed) */
export function getWildRank(roundNumber: number): Rank {
  // Round 1 = 3 cards → 3s wild, Round 11 = 13 cards → Ks wild
  const cardsDealt = roundNumber + 2;
  const rankMap: Record<number, Rank> = {
    3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
    9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
  };
  return rankMap[cardsDealt];
}

/** Cards dealt for a given round (1-indexed) */
export function getCardsDealt(roundNumber: number): number {
  return roundNumber + 2; // Round 1 → 3, Round 11 → 13
}

/** Deal hands from the draw pile, mutates drawPile in place */
export function dealHands(
  drawPile: Card[],
  playerCount: number,
  cardsEach: number
): { hands: Card[][]; remainingPile: Card[] } {
  const pile = [...drawPile];
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  for (let i = 0; i < cardsEach; i++) {
    for (let p = 0; p < playerCount; p++) {
      const card = pile.pop();
      if (!card) throw new Error('Not enough cards in draw pile');
      hands[p].push(card);
    }
  }

  return { hands, remainingPile: pile };
}

/** Mark wild cards in a hand based on current round */
export function markWilds(cards: Card[], wildRank: Rank): Card[] {
  return cards.map(c => ({ ...c, isWild: c.rank === wildRank }));
}