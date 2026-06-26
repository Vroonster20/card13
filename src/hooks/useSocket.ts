// src/hooks/useSocket.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket || !socket.connected) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? '', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { setGameState, setLobbyState, setError, setGameEnded } = useGameStore();

  const connect = useCallback(() => {
    const s = getSocket();
    socketRef.current = s;

    s.on('connect', () => {
      console.log('[Socket] Connected:', s.id);
    });

    if (!s.connected) s.connect();

    s.on('lobby:updated', ({ lobby }) => {
      setLobbyState(lobby);
    });

    s.on('lobby:started', ({ gameId }) => {
      useGameStore.getState().setCurrentGameId(gameId);
    });

    s.on('lobby:error', ({ message }) => {
      setError(message);
    });

    s.on('game:state', ({ gameState }) => {
      setGameState(gameState);
    });

    s.on('game:round_ended', ({ scores, nextRound }) => {
      useGameStore.getState().setRoundEnded({ scores, nextRound });
    });

    s.on('game:ended', ({ finalScores, winner, rankings }) => {
      setGameEnded({ finalScores, winner, rankings });
    });

    s.on('game:error', ({ message }) => {
      setError(message);
    });

    return s;
  }, [setGameState, setLobbyState, setError, setGameEnded]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // ── Emit helpers ──

  const createLobby = useCallback((hostId: string) => {
    socketRef.current?.emit('lobby:create', { hostId });
  }, []);

  const joinLobby = useCallback((code: string, userId: string) => {
    socketRef.current?.emit('lobby:join', { code, userId });
  }, []);

  const setReady = useCallback((code: string, userId: string, ready: boolean) => {
    socketRef.current?.emit('lobby:ready', { code, userId, ready });
  }, []);

  const startGame = useCallback((code: string) => {
    socketRef.current?.emit('lobby:start', { code });
  }, []);

  const reconnect = useCallback((code: string, userId: string) => {
    socketRef.current?.emit('lobby:reconnect', { code, userId });
  }, []);

  const drawFromDeck = useCallback((gameId: string, userId: string) => {
    socketRef.current?.emit('game:draw_deck', { gameId, userId });
  }, []);

  const drawFromDiscard = useCallback((gameId: string, userId: string) => {
    socketRef.current?.emit('game:draw_discard', { gameId, userId });
  }, []);

  const discardCard = useCallback((gameId: string, userId: string, cardId: string) => {
    socketRef.current?.emit('game:discard', { gameId, userId, cardId });
  }, []);

  const arrangeHand = useCallback((gameId: string, userId: string, hand: any[]) => {
    socketRef.current?.emit('game:arrange_hand', { gameId, userId, hand });
  }, []);

  const endTurn = useCallback((gameId: string, userId: string) => {
    socketRef.current?.emit('game:end_turn', { gameId, userId });
  }, []);

  const knock = useCallback((gameId: string, userId: string) => {
    socketRef.current?.emit('game:knock', { gameId, userId });
  }, []);

  return {
    connect,
    disconnect,
    createLobby,
    joinLobby,
    setReady,
    startGame,
    reconnect,
    drawFromDeck,
    drawFromDiscard,
    discardCard,
    arrangeHand,
    endTurn,
    knock,
  };
}