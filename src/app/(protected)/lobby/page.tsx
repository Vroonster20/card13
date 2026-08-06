// ─────────────────────────────────────────────
// src/app/(protected)/lobby/page.tsx — Create/Join
// ─────────────────────────────────────────────
'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/gameStore';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { ArrowLeft, Plus, LogIn } from 'lucide-react';

export default function LobbyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const socket = useSocket();
  const { lobbyState } = useGameStore();
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'pick' | 'join'>('pick');
  const [error, setError] = useState('');

  useEffect(() => {
    const s = socket.connect();
    s.on('lobby:updated', ({ lobby }) => {
      router.push(`/lobby/${lobby.code}`);
    });
    s.on('lobby:error', ({ message }) => setError(message));
    return () => socket.disconnect();
  }, []);

  const handleCreate = () => {
    if (!session?.user?.id) return;
    socket.createLobby(session.user.id);
  };

  const handleJoin = () => {
    if (!session?.user?.id || !joinCode.trim()) return;
    const s = socket.connect();
    s.emit('lobby:join', { code: joinCode.toUpperCase().trim(), userId: session.user.id });
    s.once('lobby:updated', ({ lobby }) => {
      router.push(`/lobby/${lobby.code}`);
    });
    s.once('lobby:error', ({ message }) => setError(message));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Button asChild variant="ghost" className="text-green-400 hover:text-white mb-6">
          <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
        </Button>

        <h1 className="text-2xl font-bold text-white mb-6">Play Thirteen</h1>

        {mode === 'pick' && (
          <div className="space-y-3">
            <Button onClick={handleCreate} className="w-full h-14 bg-green-600 hover:bg-green-500 text-white text-base">
              <Plus className="w-5 h-5 mr-2" />Create New Lobby
            </Button>
            <Button onClick={() => setMode('join')} variant="outline" className="w-full h-14 border-green-700 text-green-300 hover:bg-green-800 text-base">
              <LogIn className="w-5 h-5 mr-2" />Join with Code
            </Button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-3">
            <Input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-character code"
              maxLength={6}
              className="bg-green-950 border-green-700 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder:text-green-800 h-14"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <Button onClick={handleJoin} disabled={joinCode.length !== 6} className="w-full h-12 bg-green-600 hover:bg-green-500 text-white">
              Join Game
            </Button>
            <Button onClick={() => { setMode('pick'); setError(''); }} variant="ghost" className="w-full text-green-500">
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}