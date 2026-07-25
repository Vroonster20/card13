// src/lib/game-engine/scoring.ts
// Complete scoring engine for Card Game "13"

import type { Card, ServerPlayer, ScoringResult, KnockGroup, CardSet } from '@/types/game';
import { cardPoints, findBestArrangement, isValidRun, isValidSet } from './validator';
import { markWilds } from './deck';
import type { Rank } from '@/types/game';

interface GroupedCard extends Card {
  location: 'hand' | 'group';
  groupId?: number; // only set when location === 'group'
}

interface Group {
  id: number;
}

/**
 * Score a single player's hand at the end of a round.
 * Wild cards are free (score 0 if part of a valid group).
 * Cards in valid sets/runs score 0.
 * Remaining cards score their face value.
 */
export function scoreHand(hand: Card[], wildRank: Rank): ScoringResult & { userId: string } {
  // First mark wilds
  const markedHand = markWilds(hand, wildRank);

  // Find best arrangement
  const { sets, unset } = findBestArrangement(markedHand);

  console.log(sets);
  console.log(unset);

  // Score unmatched cards
  const roundScore = unset.reduce((sum, card) => {
    // Wild cards in ungrouped still count their face value (can't be in a group alone)
    return sum + cardPoints(card.rank);
  }, 0);

  const matchedCards = sets.flatMap(g => g.cards);

  return {
    userId: '', // caller fills this in
    roundScore,
    matchedCards,
    unmatchedCards: unset,
    detectedSets: sets,
  };
}

/**
 * Score all players at round end.
 * Returns a map of userId → roundScore
 */
export function scoreRound(
  players: ServerPlayer[],
  wildRank: Rank
): Map<string, ScoringResult> {
  const results = new Map<string, ScoringResult>();

  for (const player of players) {
    const score = calculateLiveScore(player.hand, player.groups);
    const result = {
      userId: player.userId,
      roundScore: score,
      matchedCards: [],
      unmatchedCards: [],
      detectedSets: [],
    };
    results.set(player.userId, result);
  }

  return results;
}

/**
 * Determine the winner after all 11 rounds.
 * Winner = player with lowest cumulative score.
 * Tiebreaker: player with more wins (not tracked here — pick first).
 */
export function determineWinner(
  cumulativeScores: Record<string, number>,
  playerOrder: string[]
): string {
  let winnerId = playerOrder[0];
  let lowestScore = cumulativeScores[playerOrder[0]] ?? Infinity;

  for (const userId of playerOrder) {
    const score = cumulativeScores[userId] ?? Infinity;
    if (score < lowestScore) {
      lowestScore = score;
      winnerId = userId;
    }
  }

  return winnerId;
}

/**
 * Build final rankings array sorted by cumulative score (ascending)
 */
export function buildRankings(
  cumulativeScores: Record<string, number>,
  players: ServerPlayer[]
): Array<{ userId: string; name: string; totalScore: number; rank: number }> {
  const sorted = players
    .map(p => ({ userId: p.userId, name: p.name, totalScore: cumulativeScores[p.userId] ?? 0 }))
    .sort((a, b) => a.totalScore - b.totalScore);

  return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
}

/**
 * Calculate user statistics delta after a completed game
 */
export function calculateStatsDelta(params: {
  userId: string;
  finalScore: number;
  finalRank: number;
  playerCount: number;
  currentStats: {
    gamesPlayed: number;
    gamesWon: number;
    lowestScore: number | null;
    highestScore: number | null;
    currentStreak: number;
    longestStreak: number;
  };
}) {
  const { userId, finalScore, finalRank, currentStats } = params;
  const isWin = finalRank === 1;

  const newStreak = isWin ? currentStats.currentStreak + 1 : 0;
  const newLongestStreak = Math.max(currentStats.longestStreak, newStreak);

  return {
    gamesPlayed: currentStats.gamesPlayed + 1,
    gamesWon: currentStats.gamesWon + (isWin ? 1 : 0),
    totalScore: 0, // will be updated via Prisma increment
    lowestScore:
      currentStats.lowestScore === null
        ? finalScore
        : Math.min(currentStats.lowestScore, finalScore),
    highestScore:
      currentStats.highestScore === null
        ? finalScore
        : Math.max(currentStats.highestScore, finalScore),
    currentStreak: newStreak,
    longestStreak: newLongestStreak,
  };
}

export function calculateLiveScore(hand: Card[], groups: KnockGroup[]): number {
    let score = 0;

    const groupedIds = new Set(groups.flatMap(g => g.cards.map(c => c.id)));
    const looseCards = hand.filter(c => !groupedIds.has(c.id));

    score += looseCards.reduce((sum, c) => sum + cardPoints(c.rank), 0);

    for (const group of groups) {
      const groupCards = group.cards;

      const valid = isValidSet(groupCards) || isValidRun(groupCards);
      if (!valid) {
        score += groupCards.reduce((sum, c) => sum + cardPoints(c.rank), 0);
      }
    }

    return score;
  }

  export function scoreGroupedHand(hand: Card[], groups: KnockGroup[]): ScoringResult & {userId: string} {
    let roundScore = 0;

    const matchedCards: Card[] = [];
    const unmatchedCards: Card[] = [];
    const detectedSets: CardSet[] = [];

    const groupedIds = new Set(groups.flatMap(g => g.cards.map(c => c.id)));
    const looseCards = hand.filter(c => !groupedIds.has(c.id));

    for (const group of groups) {
      const validSet = isValidSet(group.cards);
      const validRun = isValidRun(group.cards);

      if (validSet || validRun) {
        matchedCards.push(...group.cards);
        detectedSets.push({ type: validSet ? 'set' : 'run', cards: group.cards, isValid: true });
      } else {
        unmatchedCards.push(...group.cards, ...looseCards);
        roundScore += group.cards.reduce((sum, c) => sum + cardPoints(c.rank), 0);
        roundScore += looseCards.reduce((sum, c) => sum + cardPoints(c.rank), 0);
      }
    }

    // console.log("HAND:", hand);
    // console.log("GROUPS:", groups);
    // console.log("LOOSE:", looseCards);

    return {
      userId: '', // caller fills this in
      roundScore,
      matchedCards,
      unmatchedCards,
      detectedSets,
    };
  }