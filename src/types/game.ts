// src/types/game.ts
// Complete type definitions for the Card Game "13" engine

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;           // unique e.g. "hearts-A-0" (deck index suffix for doubles)
  suit: Suit;
  rank: Rank;
  isWild?: boolean;     // computed at round-start, not stored
}

export interface Player {
  userId: string;
  name: string;
  image?: string | null;
  seatIndex: number;
  isConnected: boolean;
  hand: Card[];         // only populated for the requesting player
  handCount: number;    // always visible to all
  isGuest: boolean;
}

export interface RoundState {
  roundNumber: number;   // 1–11
  cardsDealt: number;    // 3–13
  wildRank: Rank;
  status: 'in_progress' | 'completed';
  scores?: Record<string, number>; // userId → score, populated when completed
}

export interface GameState {
  gameId: string;
  status: 'in_progress' | 'completed';
  currentRound: RoundState;
  currentTurnUserId: string;
  players: Player[];
  discardPile: Card[];       // full discard pile, top = last element
  drawPileCount: number;     // count only, not actual cards
  cumulativeScores: Record<string, number>; // userId → running total
  roundHistory: RoundState[];
  winner?: string;           // userId of winner when game ends
}

// The full in-memory server state (includes hidden info)
export interface ServerGameState {
  gameId: string;
  status: 'in_progress' | 'completed';
  currentRound: RoundState;
  currentTurnUserId: string;
  players: ServerPlayer[];
  drawPile: Card[];
  discardPile: Card[];
  cumulativeScores: Record<string, number>;
  roundHistory: RoundState[];
  turnOrder: string[];     // userId[] in seat order
  hasDrewThisTurn: boolean; // drawn a card this turn?
  hasDiscardedThisTurn: boolean; // discarded a card this turn?
  knockedBy?: string;
  isFinalTurnPhase: boolean;
  remainingFinalTurns: string[];
  winner?: string;           // userId of winner when game ends
}

export interface ServerPlayer {
  userId: string;
  name: string;
  image?: string | null;
  seatIndex: number;
  isConnected: boolean;
  hand: Card[];
  groups: KnockGroup[];
  isGuest: boolean;
}

// Set / run groupings for scoring
export type CardSet = {
  type: 'set' | 'run';
  cards: Card[];
  isValid: boolean;
};

export interface KnockGroup {
  id: number;
  cards: Card[];
}

export type HandArrangement = {
  sets: CardSet[];
  unset: Card[];
};

// ─────────────────────────────────────────────
// SOCKET EVENT PAYLOADS
// ─────────────────────────────────────────────

export interface SocketEvents {
  // Client → Server
  'lobby:create': { hostId: string };
  'lobby:join': { code: string; userId: string };
  'lobby:ready': { code: string; userId: string; ready: boolean };
  'lobby:start': { code: string };
  'lobby:reconnect': { code: string; userId: string };

  'game:draw_deck': { gameId: string; userId: string };
  'game:draw_discard': { gameId: string; userId: string };
  'game:discard': { gameId: string; userId: string; cardId: string };
  'game:arrange_hand': { gameId: string; userId: string; hand: Card[] };

  // Server → Client
  'lobby:updated': { lobby: LobbyState };
  'lobby:started': { gameId: string };
  'lobby:error': { message: string };

  'game:state': { gameState: ClientGameState };
  'game:turn_changed': { currentPlayerId: string };
  'game:round_ended': { scores: Record<string, number>; nextRound: number | null };
  'game:ended': { finalScores: Record<string, number>; winner: string; rankings: Ranking[] };
  'game:error': { message: string };
}

export interface ClientGameState {
  gameId: string;
  status: 'in_progress' | 'completed';
  currentRound: RoundState;
  currentTurnUserId: string;
  knockedBy?: string;
  isFinalTurnPhase: boolean;
  players: ClientPlayer[];     // hands are stripped to handCount for opponents
  myHand: Card[];              // only the requesting player's hand
  discardPile: Card[];
  drawPileCount: number;
  cumulativeScores: Record<string, number>;
  roundHistory: RoundState[];
  hasDrewThisTurn: boolean;
  hasDiscardedThisTurn: boolean;
  winner?: string;
}

export interface ClientPlayer {
  userId: string;
  name: string;
  image?: string | null;
  seatIndex: number;
  isConnected: boolean;
  handCount: number;           // visible to all
  isGuest: boolean;
}

export interface Ranking {
  userId: string;
  name: string;
  totalScore: number;
  rank: number;
}

// ─────────────────────────────────────────────
// LOBBY TYPES
// ─────────────────────────────────────────────

export interface LobbyState {
  id: string;
  code: string;
  hostId: string;
  status: 'waiting' | 'starting' | 'in_game';
  players: LobbyPlayerState[];
  maxPlayers: number;
}

export interface LobbyPlayerState {
  userId: string;
  name: string;
  image?: string | null;
  isReady: boolean;
  seatIndex: number;
  isGuest: boolean;
}

// ─────────────────────────────────────────────
// SCORING TYPES
// ─────────────────────────────────────────────

export interface ScoringResult {
  userId: string;
  roundScore: number;
  matchedCards: Card[];
  unmatchedCards: Card[];
  detectedSets: CardSet[];
}