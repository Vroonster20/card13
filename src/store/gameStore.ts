// src/store/gameStore.ts
import { create } from 'zustand';
import type { ClientGameState, LobbyState } from '@/types/game';

interface GameStore {
  // Lobby
  lobbyState: LobbyState | null;
  setLobbyState: (lobby: LobbyState) => void;

  // Game
  gameState: ClientGameState | null;
  currentGameId: string | null;
  setGameState: (state: ClientGameState) => void;
  setCurrentGameId: (id: string) => void;

  // Round end overlay
  roundEnded: { scores: Record<string, number>; nextRound: number | null } | null;
  setRoundEnded: (data: { scores: Record<string, number>; nextRound: number | null }) => void;
  clearRoundEnded: () => void;

  // Game end
  gameEnded: { finalScores: Record<string, number>; winner: string; rankings: any[] } | null;
  setGameEnded: (data: { finalScores: Record<string, number>; winner: string; rankings: any[] }) => void;

  // Errors
  error: string | null;
  setError: (msg: string | null) => void;

  // Reset
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  lobbyState: null,
  gameState: null,
  currentGameId: null,
  roundEnded: null,
  gameEnded: null,
  error: null,

  setLobbyState: (lobby) => set({ lobbyState: lobby }),
  setGameState: (state) => set({ gameState: state }),
  setCurrentGameId: (id) => set({ currentGameId: id }),
  setRoundEnded: (data) => set({ roundEnded: data }),
  clearRoundEnded: () => set({ roundEnded: null }),
  setGameEnded: (data) => set({ gameEnded: data }),
  setError: (error) => set({ error }),

  reset: () =>
    set({
      lobbyState: null,
      gameState: null,
      currentGameId: null,
      roundEnded: null,
      gameEnded: null,
      error: null,
    }),
}));