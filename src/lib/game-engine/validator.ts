// src/lib/game-engine/validator.ts
// Validates sets and runs according to Card Game "13" rules

import type { Card, Rank, CardSet } from '@/types/game';

// Numeric rank ordering (Ace = 1 for run purposes)
const RANK_ORDER: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
};

export function rankValue(rank: Rank): number {
  return RANK_ORDER[rank];
}

/** Card face value for scoring */
export function cardPoints(rank: Rank): number {
  if (rank === 'A') return 1;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

/**
 * Validate a SET: 3+ cards of the same rank (wilds can substitute)
 * All non-wild cards must share the same rank.
 */
export function isValidSet(cards: Card[]): boolean {
  if (cards.length < 3) return false;

  const naturalCards = cards.filter(c => !c.isWild);
  if (naturalCards.length === 0) return false; // all wilds — not a set by itself

  const targetRank = naturalCards[0].rank;
  return naturalCards.every(c => c.rank === targetRank);
}

/**
 * Validate a RUN: 3+ consecutive ranks (wilds can fill gaps)
 * Ace rules:
 *   A-2-3 is valid (Ace at low end)
 *   Q-K-A is valid (Ace at high end, rank=14)
 *   K-A-2 is INVALID (Ace cannot bridge K→2)
 */
export function isValidRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;

  const naturals = cards.filter(c => !c.isWild);
  const wildCount = cards.filter(c => c.isWild).length;

  if (naturals.length === 0) return false;

  // Try both Ace interpretations
  return (
    _checkRun(cards, naturals, wildCount, false) ||
    _checkRun(cards, naturals, wildCount, true)
  );
}

function _checkRun(
  cards: Card[],
  naturals: Card[],
  wildCount: number,
  aceHigh: boolean
): boolean {
  const getVal = (rank: Rank): number => {
    if (rank === 'A') return aceHigh ? 14 : 1;
    return RANK_ORDER[rank];
  };

  const naturalValues = naturals.map(c => getVal(c.rank)).sort((a, b) => a - b);

  // Check no duplicate natural ranks in the run
  const uniqueVals = new Set(naturalValues);
  if (uniqueVals.size !== naturalValues.length) return false;

  // The run must span exactly cards.length consecutive values
  const minVal = naturalValues[0];
  const maxVal = naturalValues[naturalValues.length - 1];
  const span = maxVal - minVal + 1;

  // Span must not exceed total cards
  if (span > cards.length) return false;

  // Wilds needed = slots in span not filled by naturals
  const slotsInSpan = span;
  const wildsNeeded = slotsInSpan - naturals.length;

  // We might also extend the run with wilds beyond the naturals' span
  // Total run length = cards.length, wilds fill the gaps
  // Gaps = cards.length - naturals.length must be achievable
  const wildsAvailable = wildCount;
  if (wildsNeeded > wildsAvailable) return false;

  // Ace-high: cannot have 2 in the same run as A=14 (K-A is fine, A-2 would be A=14, 2=2 — gap too large for normal wild fill)
  // K-A-2: A=14, 2=2 — span = 13, cards = 3, impossible
  // Q-K-A(high): 12-13-14 — valid straight run
  // A-2-3(low): 1-2-3 — valid straight run

  return true;
}

/**
 * Find the best (lowest-score) valid arrangement of a hand.
 * Tries to match as many cards as possible into valid sets and runs.
 * Returns groups and leftover cards.
 *
 * This is NP-hard in general; we use a greedy heuristic:
 * 1. Find all possible valid groups of 3+
 * 2. Greedily pick groups that maximize cards matched
 * 3. Return matched + unmatched
 */
export function findBestArrangement(hand: Card[]): {
  sets: CardSet[];
  unset: Card[];
} {
  const usedIds = new Set<string>();
  const sets: CardSet[] = [];

  // ── Sets ──
  // Group cards by rank
  const byRank = new Map<Rank, Card[]>();
  for (const card of hand) {
    if (!card.isWild) {
      const list = byRank.get(card.rank) ?? [];
      list.push(card);
      byRank.set(card.rank, list);
    }
  }

  // Wilds pool
  const wilds = hand.filter(c => c.isWild);
  let availableWilds = [...wilds];

  // Find sets: natural cards of same rank ≥ 3 (wilds supplement if needed)
  for (const [, cards] of byRank) {
    if (cards.length >= 3) {
      const setCards = cards.map(c => ({ ...c }));
      sets.push({ type: 'set', cards: setCards, isValid: true });
      setCards.forEach(c => usedIds.add(c.id));
    } else if (cards.length === 2 && availableWilds.length >= 1) {
      const wild = availableWilds.pop()!;
      const setCards = [...cards, wild];
      sets.push({ type: 'set', cards: setCards, isValid: true });
      setCards.forEach(c => usedIds.add(c.id));
    }
  }

  // ── Runs ──
  const unused = hand.filter(c => !usedIds.has(c.id) && !c.isWild);
  const bySuit = new Map<string, Card[]>();
  for (const c of unused) {
    const key = c.suit;
    const list = bySuit.get(key) ?? [];
    list.push(c);
    bySuit.set(key, list);
  }

  for (const [, suitCards] of bySuit) {
    const sorted = [...suitCards].sort(
      (a, b) => rankValue(a.rank) - rankValue(b.rank)
    );

    let i = 0;
    while (i < sorted.length) {
      const runCards: Card[] = [sorted[i]];
      let j = i + 1;
      while (j < sorted.length) {
        const prev = rankValue(runCards[runCards.length - 1].rank);
        const curr = rankValue(sorted[j].rank);
        const gap = curr - prev;
        if (gap === 1) {
          runCards.push(sorted[j]);
          j++;
        } else if (gap === 2 && availableWilds.length > 0) {
          // fill one gap with wild
          const w = availableWilds.pop()!;
          runCards.push(w, sorted[j]);
          j++;
        } else {
          break;
        }
      }

      if (runCards.length >= 3 && isValidRun(runCards)) {
        sets.push({ type: 'run', cards: runCards, isValid: true });
        runCards.forEach(c => usedIds.add(c.id));
      }
      i = j;
    }
  }

  const unset = hand.filter(c => !usedIds.has(c.id));

  return { sets, unset };
}

/**
 * Validate a user-submitted arrangement.
 * Returns true if all groups in the arrangement are valid.
 */
export function validateArrangement(sets: CardSet[]): boolean {
  return sets.every(set =>
    set.type === 'set' ? isValidSet(set.cards) : isValidRun(set.cards)
  );
}