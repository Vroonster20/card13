// src/server/socket-server.ts
// Complete Socket.IO server with lobby and game management

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { prisma } from '@/lib/prisma';
import {
  createShuffledDoubleDeck,
  dealHands,
  getCardsDealt,
  getWildRank,
  markWilds,
  shuffle,
} from '@/lib/game-engine/deck';
import { scoreRound, determineWinner, buildRankings, calculateStatsDelta } from '@/lib/game-engine/scoring';
import type {
  ServerGameState,
  LobbyState,
  ClientGameState,
  ServerPlayer,
  RoundState,
  Card,
} from '@/types/game';
import type { Rank, KnockGroup } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';
import { isValidRun, isValidSet, validateArrangement } from '@/lib/game-engine/validator';

// ─────────────────────────────────────────────
// In-memory state stores
// ─────────────────────────────────────────────
const gameStates = new Map<string, ServerGameState>();
const lobbyStates = new Map<string, LobbyState>();
const socketToUser = new Map<string, { userId: string; gameId?: string; lobbyCode?: string }>();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Strip hand cards for broadcast — only show own hand */
function buildClientState(gameState: ServerGameState, forUserId: string): ClientGameState {
  const myPlayer = gameState.players.find(p => p.userId === forUserId);
  const myHand = myPlayer ? markWilds(myPlayer.hand, gameState.currentRound.wildRank) : [];

  return {
    gameId: gameState.gameId,
    status: gameState.status,
    currentRound: gameState.currentRound,
    currentTurnUserId: gameState.currentTurnUserId,
    players: gameState.players.map(p => ({
      userId: p.userId,
      name: p.name,
      image: p.image,
      seatIndex: p.seatIndex,
      isConnected: p.isConnected,
      handCount: p.hand.length,
    })),
    myHand,
    discardPile: gameState.discardPile,
    drawPileCount: gameState.drawPile.length,
    cumulativeScores: gameState.cumulativeScores,
    roundHistory: gameState.roundHistory,
    hasDrewThisTurn: gameState.hasDrewThisTurn,
    hasDiscardedThisTurn: gameState.hasDiscardedThisTurn,
    knockedBy: gameState.knockedBy,
    isFinalTurnPhase: gameState.isFinalTurnPhase,
    winner: gameState.winner,
  };
}

/** Broadcast game state to all players individually */
function broadcastGameState(io: SocketIOServer, gameState: ServerGameState) {
  for (const [socketId, info] of socketToUser) {
    if (info.gameId === gameState.gameId) {
      const clientState = buildClientState(gameState, info.userId);
      io.to(socketId).emit('game:state', { gameState: clientState });
    }
  }
}

/** Advance turn to next connected player */
function nextTurn(gameState: ServerGameState): string {
  const order = gameState.turnOrder;
  const currentIdx = order.indexOf(gameState.currentTurnUserId);
  let nextIdx = (currentIdx + 1) % order.length;
  let attempts = 0;
  while (!gameState.players.find(p => p.userId === order[nextIdx])?.isConnected) {
    nextIdx = (nextIdx + 1) % order.length;
    if (++attempts > order.length) break; // all disconnected fallback
  }
  return order[nextIdx];
}

/** Initialize a new round */
function initRound(gameState: ServerGameState, roundNumber: number): void {
  const cardsDealt = getCardsDealt(roundNumber);
  const wildRank = getWildRank(roundNumber);

  // Re-shuffle if draw pile too small
  if (gameState.drawPile.length < gameState.players.length * cardsDealt + 1) {
    const combined = shuffle([...gameState.drawPile, ...gameState.discardPile]);
    gameState.drawPile = combined;
    gameState.discardPile = [];
  }

  const { hands, remainingPile } = dealHands(
    gameState.drawPile,
    gameState.players.length,
    cardsDealt
  );

  gameState.drawPile = remainingPile;
  gameState.players.forEach((p, idx) => {
    p.hand = hands[idx];
  });

  // Flip one card to start discard pile
  const firstDiscard = gameState.drawPile.pop();
  if (firstDiscard) gameState.discardPile = [firstDiscard];

  gameState.currentRound = {
    roundNumber,
    cardsDealt,
    wildRank,
    status: 'in_progress',
  };

  gameState.hasDrewThisTurn = false;
  // First turn goes to seat 0 each round (or rotate — seat 0 for simplicity)
  gameState.currentTurnUserId = gameState.turnOrder[0];
}

/** Persist round scores to DB */
async function persistRoundScores(
  gameId: string,
  roundNumber: number,
  scores: Map<string, { roundScore: number }>
) {
  const round = await prisma.round.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber } },
  });
  if (!round) return;

  const gamePlayers = await prisma.gamePlayer.findMany({ where: { gameId } });

  for (const gp of gamePlayers) {
    const score = scores.get(gp.userId);
    if (!score) continue;
    await prisma.roundScore.upsert({
      where: { roundId_gamePlayerId: { roundId: round.id, gamePlayerId: gp.id } },
      update: { rawScore: score.roundScore, totalScore: score.roundScore },
      create: {
        roundId: round.id,
        gamePlayerId: gp.id,
        rawScore: score.roundScore,
        totalScore: score.roundScore,
      },
    });
  }
}

/** Persist game end to DB and update statistics */
async function persistGameEnd(gameState: ServerGameState) {
  const { gameId, cumulativeScores, players } = gameState;
  const rankings = buildRankings(cumulativeScores, players);

  await prisma.$transaction(async tx => {
    // Update game record
    await tx.game.update({
      where: { id: gameId },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });

    // Update each player's final score and rank
    for (const ranking of rankings) {
      const gp = await tx.gamePlayer.findFirst({
        where: { gameId, userId: ranking.userId },
      });
      if (!gp) continue;

      await tx.gamePlayer.update({
        where: { id: gp.id },
        data: { finalScore: ranking.totalScore, finalRank: ranking.rank },
      });

      // Save match history
      await tx.matchHistory.create({
        data: {
          userId: ranking.userId,
          gameId,
          playerCount: players.length,
          finalScore: ranking.totalScore,
          finalRank: ranking.rank,
          rounds: [],
        },
      });

      // Update statistics
      const stats = await tx.userStatistics.findUnique({ where: { userId: ranking.userId } });
      if (stats) {
        const delta = calculateStatsDelta({
          userId: ranking.userId,
          finalScore: ranking.totalScore,
          finalRank: ranking.rank,
          playerCount: players.length,
          currentStats: {
            gamesPlayed: stats.gamesPlayed,
            gamesWon: stats.gamesWon,
            lowestScore: stats.lowestScore,
            highestScore: stats.highestScore,
            currentStreak: stats.currentStreak,
            longestStreak: stats.longestStreak,
          },
        });

        await tx.userStatistics.update({
          where: { userId: ranking.userId },
          data: {
            ...delta,
            totalScore: { increment: ranking.totalScore },
          },
        });
      } else {
        await tx.userStatistics.create({
          data: {
            userId: ranking.userId,
            gamesPlayed: 1,
            gamesWon: ranking.rank === 1 ? 1 : 0,
            totalScore: ranking.totalScore,
            lowestScore: ranking.totalScore,
            highestScore: ranking.totalScore,
            currentStreak: ranking.rank === 1 ? 1 : 0,
            longestStreak: ranking.rank === 1 ? 1 : 0,
          },
        });
      }
    }
  });
}

// ─────────────────────────────────────────────
// Main Socket.IO Setup
// ─────────────────────────────────────────────

export function setupSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── LOBBY EVENTS ──────────────────────────────

    socket.on('lobby:create', async ({ hostId }: { hostId: string }) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: hostId } });
        if (!user) return socket.emit('lobby:error', { message: 'User not found' });

        let code = generateLobbyCode();
        // Ensure unique
        while (await prisma.lobby.findUnique({ where: { code } })) {
          code = generateLobbyCode();
        }

        const lobby = await prisma.lobby.create({
          data: {
            code,
            hostId,
            players: {
              create: { userId: hostId, isReady: false, seatIndex: 0 },
            },
          },
          include: { players: { include: { user: true } } },
        });

        const lobbyState: LobbyState = {
          id: lobby.id,
          code: lobby.code,
          hostId: lobby.hostId,
          status: 'waiting',
          maxPlayers: 7,
          players: lobby.players.map(p => ({
            userId: p.userId,
            name: p.user.name ?? 'Player',
            image: p.user.image,
            isReady: p.isReady,
            seatIndex: p.seatIndex,
          })),
        };

        lobbyStates.set(code, lobbyState);
        socketToUser.set(socket.id, { userId: hostId, lobbyCode: code });

        socket.join(`lobby:${code}`);
        socket.emit('lobby:updated', { lobby: lobbyState });
      } catch (err) {
        console.error('[lobby:create]', err);
        socket.emit('lobby:error', { message: 'Failed to create lobby' });
      }
    });

    socket.on('lobby:join', async ({ code, userId }: { code: string; userId: string }) => {
      try {
        const lobby = await prisma.lobby.findUnique({
          where: { code },
          include: { players: true },
        });

        if (!lobby) return socket.emit('lobby:error', { message: 'Lobby not found' });
        if (lobby.status !== 'WAITING') return socket.emit('lobby:error', { message: 'Lobby is not open' });
        if (lobby.players.length >= 7) return socket.emit('lobby:error', { message: 'Lobby is full (max 7 players)' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return socket.emit('lobby:error', { message: 'User not found' });

        // Already in lobby?
        const existing = lobby.players.find(p => p.userId === userId);
        if (!existing) {
          const seatIndex = lobby.players.length;
          await prisma.lobbyPlayer.create({
            data: { lobbyId: lobby.id, userId, isReady: false, seatIndex },
          });
        }

        const updatedLobby = await prisma.lobby.findUnique({
          where: { code },
          include: { players: { include: { user: true } } },
        });

        const lobbyState: LobbyState = {
          id: updatedLobby!.id,
          code: updatedLobby!.code,
          hostId: updatedLobby!.hostId,
          status: 'waiting',
          maxPlayers: 7,
          players: updatedLobby!.players.map(p => ({
            userId: p.userId,
            name: p.user.name ?? 'Player',
            image: p.user.image,
            isReady: p.isReady,
            seatIndex: p.seatIndex,
          })),
        };

        lobbyStates.set(code, lobbyState);
        socketToUser.set(socket.id, { userId, lobbyCode: code });

        socket.join(`lobby:${code}`);
        io.to(`lobby:${code}`).emit('lobby:updated', { lobby: lobbyState });
      } catch (err) {
        console.error('[lobby:join]', err);
        socket.emit('lobby:error', { message: 'Failed to join lobby' });
      }
    });

    socket.on('lobby:ready', async ({ code, userId, ready }: { code: string; userId: string; ready: boolean }) => {
      try {
        await prisma.lobbyPlayer.updateMany({
          where: { lobby: { code }, userId },
          data: { isReady: ready },
        });

        const lobby = lobbyStates.get(code);
        if (!lobby) return;

        const player = lobby.players.find(p => p.userId === userId);
        if (player) player.isReady = ready;

        io.to(`lobby:${code}`).emit('lobby:updated', { lobby });
      } catch (err) {
        console.error('[lobby:ready]', err);
      }
    });

    socket.on('lobby:start', async ({ code }: { code: string }) => {
      try {
        const lobby = lobbyStates.get(code);
        if (!lobby) return socket.emit('lobby:error', { message: 'Lobby not found' });

        const userInfo = socketToUser.get(socket.id);
        if (!userInfo || userInfo.userId !== lobby.hostId) {
          return socket.emit('lobby:error', { message: 'Only the host can start the game' });
        }

        if (lobby.players.length < 2) {
          return socket.emit('lobby:error', { message: 'Need at least 2 players' });
        }

        const nonHostReady = lobby.players.filter(p => p.userId !== lobby.hostId);
        if (nonHostReady.some(p => !p.isReady)) {
          return socket.emit('lobby:error', { message: 'All players must be ready' });
        }

        // Create game in DB
        const dbLobby = await prisma.lobby.findUnique({ where: { code } });
        if (!dbLobby) return;

        const game = await prisma.game.create({
          data: {
            lobbyId: dbLobby.id,
            hostId: lobby.hostId,
            status: 'IN_PROGRESS',
            currentRound: 1,
            currentTurnUserId: lobby.players[0].userId,
            players: {
              create: lobby.players.map(p => ({
                userId: p.userId,
                seatIndex: p.seatIndex,
              })),
            },
          },
        });

        // Update lobby status
        await prisma.lobby.update({
          where: { code },
          data: { status: 'IN_GAME' },
        });

        // Initialize in-memory game state
        const drawPile = createShuffledDoubleDeck();
        const turnOrder = [...lobby.players]
          .sort((a, b) => a.seatIndex - b.seatIndex)
          .map(p => p.userId);

        const serverPlayers: ServerPlayer[] = lobby.players.map(p => ({
          userId: p.userId,
          name: p.name,
          image: p.image,
          seatIndex: p.seatIndex,
          isConnected: true,
          hand: [],
          groups: [],
        }));

        const gameState: ServerGameState = {
          gameId: game.id,
          status: 'in_progress',
          currentRound: {
            roundNumber: 1,
            cardsDealt: getCardsDealt(1),
            wildRank: getWildRank(1),
            status: 'in_progress',
          },
          currentTurnUserId: turnOrder[0],
          players: serverPlayers,
          drawPile,
          discardPile: [],
          cumulativeScores: Object.fromEntries(lobby.players.map(p => [p.userId, 0])),
          roundHistory: [],
          turnOrder,
          hasDrewThisTurn: false,
          hasDiscardedThisTurn: false,
          knockedBy: undefined,
          isFinalTurnPhase: false,
          remainingFinalTurns: [],
        };

        // Deal round 1
        initRound(gameState, 1);
        gameStates.set(game.id, gameState);

        // Create round 1 in DB
        await prisma.round.create({
          data: {
            gameId: game.id,
            roundNumber: 1,
            wildRank: gameState.currentRound.wildRank,
            cardsDealt: gameState.currentRound.cardsDealt,
          },
        });

        // Update socketToUser with gameId
        for (const [sid, info] of socketToUser) {
          if (info.lobbyCode === code) {
            socketToUser.set(sid, { ...info, gameId: game.id });
            io.sockets.sockets.get(sid)?.join(`game:${game.id}`);
          }
        }

        io.to(`lobby:${code}`).emit('lobby:started', { gameId: game.id });

        // Broadcast initial game state
        broadcastGameState(io, gameState);
      } catch (err) {
        console.error('[lobby:start]', err);
        socket.emit('lobby:error', { message: 'Failed to start game' });
      }
    });

    socket.on('lobby:reconnect', async ({ code, userId }: { code: string; userId: string }) => {
      socketToUser.set(socket.id, { userId, lobbyCode: code });
      socket.join(`lobby:${code}`);

      const lobby = lobbyStates.get(code);
      if (lobby) {
        socket.emit('lobby:updated', { lobby });
      }

      // If game is in progress, re-join game room
      const dbLobby = await prisma.lobby.findUnique({
        where: { code },
        include: { game: true },
      });
      if (dbLobby?.game) {
        const gameId = dbLobby.game.id;
        socketToUser.set(socket.id, { userId, lobbyCode: code, gameId });
        socket.join(`game:${gameId}`);

        const gameState = gameStates.get(gameId);
        if (gameState) {
          const player = gameState.players.find(p => p.userId === userId);
          if (player) player.isConnected = true;
          const clientState = buildClientState(gameState, userId);
          socket.emit('game:state', { gameState: clientState });
        }
      }
    });

    // ── GAME EVENTS ──────────────────────────────

    socket.on('game:draw_deck', ({ gameId, userId }: { gameId: string; userId: string }) => {
      const gameState = gameStates.get(gameId);
      if (!gameState) return socket.emit('game:error', { message: 'Game not found' });
      if (gameState.currentTurnUserId !== userId) return socket.emit('game:error', { message: 'Not your turn' });
      if (gameState.hasDrewThisTurn) return socket.emit('game:error', { message: 'Already drew this turn' });

      const card = gameState.drawPile.pop();
      if (!card) return socket.emit('game:error', { message: 'Draw pile is empty' });

      const player = gameState.players.find(p => p.userId === userId);
      if (!player) return;

      player.hand.push(card);
      gameState.hasDrewThisTurn = true;

      broadcastGameState(io, gameState);
    });

    socket.on('game:draw_discard', ({ gameId, userId }: { gameId: string; userId: string }) => {
      const gameState = gameStates.get(gameId);
      if (!gameState) return socket.emit('game:error', { message: 'Game not found' });
      if (gameState.currentTurnUserId !== userId) return socket.emit('game:error', { message: 'Not your turn' });
      if (gameState.hasDrewThisTurn) return socket.emit('game:error', { message: 'Already drew this turn' });
      if (gameState.discardPile.length === 0) return socket.emit('game:error', { message: 'Discard pile is empty' });

      const card = gameState.discardPile.pop()!;
      const player = gameState.players.find(p => p.userId === userId);
      if (!player) return;

      player.hand.push(card);
      gameState.hasDrewThisTurn = true;

      broadcastGameState(io, gameState);
    });

    socket.on('game:discard', async ({ gameId, userId, cardId }: { gameId: string; userId: string; cardId: string }) => {
      const gameState = gameStates.get(gameId);
      if (!gameState) return socket.emit('game:error', { message: 'Game not found' });
      if (gameState.currentTurnUserId !== userId) return socket.emit('game:error', { message: 'Not your turn' });
      if (!gameState.hasDrewThisTurn) return socket.emit('game:error', { message: 'Must draw before discarding' });

      const player = gameState.players.find(p => p.userId === userId);
      if (!player) return;

      const cardIdx = player.hand.findIndex(c => c.id === cardId);
      if (cardIdx === -1) return socket.emit('game:error', { message: 'Card not in hand' });

      const [discarded] = player.hand.splice(cardIdx, 1);
      gameState.discardPile.push(discarded);
      gameState.hasDiscardedThisTurn = true;

      broadcastGameState(io, gameState);
    });

    socket.on('game:update_groups', ({ gameId, userId, groups }) => {
      const gameState = gameStates.get(gameId);
      if (!gameState) return socket.emit('game:error', { message: 'Game not found' });

      console.log("Updated groups:", groups);
      const player = gameState.players.find(p => p.userId === userId);
      if (!player) return;

      player.groups = groups;
      broadcastGameState(io, gameState);
    });

    // Handle Knock and End Turn Events/Logic below
    // socket.on('game:end_turn'...)
    socket.on('game:end_turn', async ({ gameId, userId }: { gameId: string; userId: string }) => {
      const gameState = gameStates.get(gameId);
      if (!gameState) return socket.emit('game:error', { message: 'Game not found' });
      if (gameState.currentTurnUserId !== userId) return socket.emit('game:error', { message: 'Not your turn' });
      if (!gameState.hasDiscardedThisTurn) return socket.emit('game:error', { message: 'Must discard before ending turn' });

      // Advance turn
      if (gameState.isFinalTurnPhase) {
        // Remove current player from remainingFinalTurns
        gameState.remainingFinalTurns = gameState.remainingFinalTurns.filter(id => id !== userId);
        
        if (gameState.remainingFinalTurns.length === 0) {
          gameState.hasDiscardedThisTurn = false;
          await handleRoundEnd(io, gameState);
          return;
        }
      }

      gameState.hasDrewThisTurn = false;
      gameState.hasDiscardedThisTurn = false;
      gameState.currentTurnUserId = nextTurn(gameState);

      broadcastGameState(io, gameState);
    });

    socket.on('game:knock', ({ gameId, userId, groups }) => {
      const gameState = gameStates.get(gameId);
      if (!gameState) return socket.emit('game:error', { message: 'Game not found' });
      if (gameState.isFinalTurnPhase) return socket.emit('game:error', { message: 'Someone already knocked' });

      const result = canKnock(groups);
      if (!result.valid) return socket.emit('game:error', { message: result.message });

      const validation = canKnockWithHand(groups);
      if (!validation) return socket.emit('game:error', { message: 'You cannot knock with your group(s)' });

      gameState.knockedBy = userId;
      gameState.isFinalTurnPhase = true;

      gameState.remainingFinalTurns =
      gameState.turnOrder.filter(id => id !== userId);

      // Advance turn
      gameState.hasDrewThisTurn = false;
      gameState.hasDiscardedThisTurn = false;
      gameState.currentTurnUserId = nextTurn(gameState);

      broadcastGameState(io, gameState);
    });

    function canKnock(groups: KnockGroup[]) {
      if (groups.length === 0) {
        return {
          valid: false,
          message: "You must create at least one group.",
        };
      }

      for (const group of groups) {
        if (group.cards.length < 3) {
          return {
            valid: false,
            message: `Group ${group.id} must contain at least 3 cards.`,
          };
        }
      }

      const allCards = groups.flatMap(g => g.cards.map(c => c.id));
      const uniqueCards = new Set(allCards);

      if (allCards.length !== uniqueCards.size) {
        return {
          valid: false,
          message: "A card cannot appear in more than one group.",
        };
      }

      return {
        valid: true,
        message: "",
      };
    }

    interface CardGroup {
      type: 'set' | 'run';
      cards: Card[];
      isValid: boolean;
    }

    function canKnockWithHand(groups: KnockGroup[]) {
      const cardGroups: CardGroup[] = [];

      for (const group of groups) {
        if (isValidSet(group.cards)) {
          cardGroups.push({ type: 'set', cards: group.cards, isValid: true });
        }
        else if (isValidRun(group.cards)) {
          cardGroups.push({type: 'run', cards: group.cards, isValid: true});
        }
        else {
          return false;
        }
      }

      return validateArrangement(cardGroups);
    }

    socket.on('game:arrange_hand', ({ gameId, userId, hand }: { gameId: string; userId: string; hand: any[] }) => {
      const gameState = gameStates.get(gameId);
      if (!gameState) return;

      const player = gameState.players.find(p => p.userId === userId);
      if (!player) return;

      // Validate hand contains same cards
      if (hand.length !== player.hand.length) return;

      // Reorder (client-side arrangement)
      player.hand = hand;

      // Only notify the arranging player
      const clientState = buildClientState(gameState, userId);
      socket.emit('game:state', { gameState: clientState });
    });

    // ── DISCONNECT ──────────────────────────────

    socket.on('disconnect', () => {
      const info = socketToUser.get(socket.id);
      if (!info) return;

      if (info.gameId) {
        const gameState = gameStates.get(info.gameId);
        if (gameState) {
          const player = gameState.players.find(p => p.userId === info.userId);
          if (player) {
            //player.isConnected = false;
            broadcastGameState(io, gameState);
          }
        }
      }

      socketToUser.delete(socket.id);
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
}

// ─────────────────────────────────────────────
// Round End Logic
// ─────────────────────────────────────────────

async function handleRoundEnd(io: SocketIOServer, gameState: ServerGameState) {
  const { currentRound, players, cumulativeScores, gameId } = gameState;

  // Score all players
  //scoreRound uses scoreGroupedHand, this will need to change since
  //scoreGroupedHand will be removed with calculateLiveScore
  const scores = scoreRound(players, currentRound.wildRank);

  // Update cumulative scores
  for (const [userId, result] of scores) {
    cumulativeScores[userId] = (cumulativeScores[userId] ?? 0) + result.roundScore;
  }

  // Mark round as complete
  currentRound.status = 'completed';
  currentRound.scores = Object.fromEntries(
    [...scores.entries()].map(([uid, r]) => [uid, r.roundScore])
  );

  gameState.roundHistory.push({ ...currentRound });

  // Persist round scores
  await persistRoundScores(gameId, currentRound.roundNumber, scores);

  // Update DB round status
  await prisma.round.updateMany({
    where: { gameId, roundNumber: currentRound.roundNumber },
    data: { status: 'COMPLETED', endedAt: new Date() },
  });

  // Check if game is over (11 rounds completed)
  if (currentRound.roundNumber >= 11) {
    await handleGameEnd(io, gameState);
    return;
  }

  // Notify round end
  const scoreMap = Object.fromEntries(
    [...scores.entries()].map(([uid, r]) => [uid, r.roundScore])
  );
  io.to(`game:${gameId}`).emit('game:round_ended', {
    scores: scoreMap,
    nextRound: currentRound.roundNumber + 1,
  });

  // Brief pause then start next round
  setTimeout(async () => {
    const nextRoundNum = currentRound.roundNumber + 1;
    initRound(gameState, nextRoundNum);

    // Create round in DB
    await prisma.round.create({
      data: {
        gameId,
        roundNumber: nextRoundNum,
        wildRank: gameState.currentRound.wildRank,
        cardsDealt: gameState.currentRound.cardsDealt,
      },
    });

    broadcastGameState(io, gameState);
  }, 5000); // 5s delay to show scores

  gameState.isFinalTurnPhase = false;
  gameState.knockedBy = undefined;
  gameState.remainingFinalTurns = [];
}

async function handleGameEnd(io: SocketIOServer, gameState: ServerGameState) {
  gameState.status = 'completed';

  const rankings = buildRankings(gameState.cumulativeScores, gameState.players);
  const winner = determineWinner(gameState.cumulativeScores, gameState.turnOrder);
  gameState.winner = winner;

  await persistGameEnd(gameState);

  io.to(`game:${gameState.gameId}`).emit('game:ended', {
    finalScores: gameState.cumulativeScores,
    winner,
    rankings,
  });

  broadcastGameState(io, gameState);

  // Clean up in-memory state after a delay
  setTimeout(() => {
    gameStates.delete(gameState.gameId);
  }, 60_000);
}