// src/components/lobby/LobbyRoom.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Copy, CheckCircle, Circle, UserX, Play, ArrowLeft } from 'lucide-react';

interface LobbyRoomProps {
  lobbyCode: string;
}

export function LobbyRoom({ lobbyCode }: LobbyRoomProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id ?? '';

  const { lobbyState, currentGameId, error } = useGameStore();
  const socket = useSocket();

  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const s = socket.connect();

    // Reconnect or join
    s.emit('lobby:reconnect', { code: lobbyCode, userId });

    return () => socket.disconnect();
  }, [lobbyCode, userId]);

  // Navigate to game when started
  useEffect(() => {
    if (currentGameId) {
      router.push(`/game/${currentGameId}`);
    }
  }, [currentGameId]);

  const handleReady = () => {
    const newReady = !isReady;
    setIsReady(newReady);
    socket.setReady(lobbyCode, userId, newReady);
  };

  const handleStart = () => {
    socket.startGame(lobbyCode);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost = lobbyState?.hostId === userId;
  const myPlayer = lobbyState?.players.find(p => p.userId === userId);
  const allReady = lobbyState?.players
    .filter(p => p.userId !== lobbyState.hostId)
    .every(p => p.isReady) ?? false;
  const canStart = isHost && (lobbyState?.players.length ?? 0) >= 2 && allReady;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/lobby')}
            className="text-green-300 hover:text-white hover:bg-green-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-white">Game Lobby</h1>
        </div>

        {/* Join Code Card */}
        <div className="bg-green-900/60 border border-green-700 rounded-2xl p-5 mb-4 backdrop-blur">
          <p className="text-xs text-green-400 uppercase tracking-widest mb-2">Join Code</p>
          <div className="flex items-center justify-between">
            <span className="text-4xl font-mono font-bold text-white tracking-[0.3em]">
              {lobbyCode}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="text-green-300 hover:text-white"
            >
              {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            </Button>
          </div>
          <p className="text-xs text-green-500 mt-2">Share this code with friends to join</p>
        </div>

        {/* Player List */}
        <div className="bg-green-900/60 border border-green-700 rounded-2xl p-5 mb-4 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-green-300 uppercase tracking-wide">
              Players ({lobbyState?.players.length ?? 0}/7)
            </h2>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {lobbyState?.players.map((player) => (
                <motion.div
                  key={player.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 bg-green-800/50 rounded-xl px-4 py-3"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {player.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {player.name}
                      </span>
                      {player.userId === lobbyState.hostId && (
                        <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                      )}
                      {player.userId === userId && (
                        <Badge variant="outline" className="text-[10px] border-green-500 text-green-400 px-1.5">
                          You
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Ready status */}
                  <div>
                    {player.userId === lobbyState.hostId ? (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs">
                        Host
                      </Badge>
                    ) : player.isReady ? (
                      <div className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Ready
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <Circle className="w-3.5 h-3.5" />
                        Waiting
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 7 - (lobbyState?.players.length ?? 0)) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 border-2 border-dashed border-green-800 rounded-xl px-4 py-3 opacity-40"
              >
                <div className="w-9 h-9 rounded-full bg-green-900 border-2 border-dashed border-green-700" />
                <span className="text-sm text-green-700">Waiting for player...</span>
                <UserX className="ml-auto w-4 h-4 text-green-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl p-3 mb-4 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isHost && (
            <Button
              onClick={handleReady}
              className={`flex-1 ${
                isReady
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              {isReady ? (
                <><CheckCircle className="w-4 h-4 mr-2" />Ready!</>
              ) : (
                <>Ready Up</>
              )}
            </Button>
          )}

          {isHost && (
            <Button
              onClick={handleStart}
              disabled={!canStart}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold"
            >
              <Play className="w-4 h-4 mr-2" />
              {canStart ? 'Start Game' : 'Waiting for players...'}
            </Button>
          )}
        </div>

        {isHost && !canStart && (
          <p className="text-xs text-green-600 text-center mt-2">
            {(lobbyState?.players.length ?? 0) < 2
              ? 'Need at least 2 players'
              : 'All non-host players must be ready'}
          </p>
        )}
      </div>
    </div>
  );
}