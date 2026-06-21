// src/components/game/GameBoard.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/gameStore';
import { CardComponent } from './CardComponent';
import { DrawPile } from './DrawPile';
import { DiscardPile } from './DiscardPile';
import { ScoreBoard } from './ScoreBoard';
import { TurnIndicator } from './TurnIndicator';
import { WildCardDisplay } from './WildCardDisplay';
import { RoundEndOverlay } from './RoundEndOverlay';
import { GameEndOverlay } from './GameEndOverlay';
import { findBestArrangement } from '@/lib/game-engine/validator';
import { markWilds } from '@/lib/game-engine/deck';
import type { Card, CardGroup } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wand2, SortAsc } from 'lucide-react';

interface GameBoardProps {
  gameId: string;
}

export function GameBoard({ gameId }: GameBoardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id ?? '';

  const { gameState, roundEnded, gameEnded, error } = useGameStore();
  const lobbyState = useGameStore(state => state.lobbyState);
  const socket = useSocket();

  const [localHand, setLocalHand] = useState<Card[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [detectedGroups, setDetectedGroups] = useState<CardGroup[]>([]);
  const [autoSort, setAutoSort] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Connect socket on mount
  useEffect(() => {
    socket.connect();
    socket.reconnect(lobbyState?.code ?? '', userId); // lobbyCode fetched from URL/store
    return () => socket.disconnect();
  }, []);

  // Sync hand from server state
  useEffect(() => {
    if (gameState?.myHand) {
      const wild = gameState.currentRound.wildRank;
      const markedHand = markWilds(gameState.myHand, wild);
      setLocalHand(markedHand);
      detectGroups(markedHand, wild);
    }
  }, [gameState?.myHand]);

  const detectGroups = useCallback((hand: Card[], wildRank: string) => {
    const marked = markWilds(hand, wildRank as any);
    const { groups } = findBestArrangement(marked);
    setDetectedGroups(groups);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const card = localHand.find(c => c.id === event.active.id);
    setActiveCard(card ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = localHand.findIndex(c => c.id === active.id);
    const newIdx = localHand.findIndex(c => c.id === over.id);
    const newHand = arrayMove(localHand, oldIdx, newIdx);

    setLocalHand(newHand);
    socket.arrangeHand(gameId, userId, newHand);
  };

  const handleAutoSort = () => {
    if (!gameState) return;
    const wild = gameState.currentRound.wildRank;
    const marked = markWilds(localHand, wild);
    const { groups, ungrouped } = findBestArrangement(marked);
    const sorted = [...groups.flatMap(g => g.cards), ...ungrouped];
    setLocalHand(sorted);
    socket.arrangeHand(gameId, userId, sorted);
  };

  const handleDrawDeck = () => socket.drawFromDeck(gameId, userId);
  const handleDrawDiscard = () => socket.drawFromDiscard(gameId, userId);
  const handleDiscard = (cardId: string) => socket.discardCard(gameId, userId, cardId);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-12 w-12 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isMyTurn = gameState.currentTurnUserId === userId;
  const canDraw = isMyTurn && !gameState.hasDrewThisTurn;
  const canDiscard = isMyTurn && gameState.hasDrewThisTurn;
  const wildRank = gameState.currentRound.wildRank;

  const cardInGroup = (card: Card) =>
    detectedGroups.some(g => g.cards.some(c => c.id === card.id));

  return (
    <div className="min-h-screen bg-green-950 text-white flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-green-900/60 backdrop-blur border-b border-green-800">
        <WildCardDisplay wildRank={wildRank} roundNumber={gameState.currentRound.roundNumber} />
        <TurnIndicator
          players={gameState.players}
          currentTurnUserId={gameState.currentTurnUserId}
          myUserId={userId}
        />
        <ScoreBoard players={gameState.players} scores={gameState.cumulativeScores} />
      </div>

      {/* Other Players */}
      <div className="flex justify-center gap-8 py-4 px-4 flex-wrap">
        {gameState.players
          .filter(p => p.userId !== userId)
          .map(player => (
            <motion.div
              key={player.userId}
              className={`flex flex-col items-center gap-1 ${
                gameState.currentTurnUserId === player.userId ? 'ring-2 ring-yellow-400 rounded-xl p-2' : 'p-2'
              }`}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: player.handCount }).map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-12 bg-blue-800 border border-blue-600 rounded-md shadow"
                    style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)' }}
                  />
                ))}
              </div>
              <span className="text-xs text-green-300 truncate max-w-20">
                {player.name}
              </span>
              {!player.isConnected && (
                <Badge variant="destructive" className="text-xs">Disconnected</Badge>
              )}
            </motion.div>
          ))}
      </div>

      {/* Center: Draw + Discard */}
      <div className="flex-1 flex items-center justify-center gap-12">
        <DrawPile
          count={gameState.drawPileCount}
          canDraw={canDraw}
          onDraw={handleDrawDeck}
        />
        <DiscardPile
          topCard={gameState.discardPile[gameState.discardPile.length - 1] ?? null}
          canDraw={canDraw}
          onDraw={handleDrawDiscard}
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-36 left-1/2 -translate-x-1/2 bg-red-900 text-red-100 px-4 py-2 rounded-lg text-sm shadow-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* My Hand */}
      <div className="bg-green-900/80 border-t border-green-700 p-4">
        {/* Hand Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAutoSort}
              className="text-green-100 border-green-600 hover:bg-green-800"
            >
              <SortAsc className="w-4 h-4 mr-1" />
              Auto Sort
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAutoSort(a => !a)}
              className={`text-green-100 border-green-600 ${autoSort ? 'bg-green-700' : 'hover:bg-green-800'}`}
            >
              <Wand2 className="w-4 h-4 mr-1" />
              Highlight Groups
            </Button>
          </div>
          <div className="text-sm text-green-300">
            {isMyTurn
              ? canDraw
                ? '🃏 Draw a card'
                : '🗑️ Discard a card'
              : '⏳ Waiting...'}
          </div>
        </div>

        {/* Draggable Hand */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localHand.map(c => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-1 justify-center flex-wrap min-h-24">
              {localHand.map((card) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  isInGroup={autoSort && cardInGroup(card)}
                  canDiscard={canDiscard}
                  onDiscard={handleDiscard}
                  wildRank={wildRank}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeCard ? (
              <CardComponent
                card={activeCard}
                isInGroup={false}
                canDiscard={false}
                onDiscard={() => {}}
                wildRank={wildRank}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {roundEnded && (
          <RoundEndOverlay
            scores={roundEnded.scores}
            nextRound={roundEnded.nextRound}
            players={gameState.players}
            cumulativeScores={gameState.cumulativeScores}
          />
        )}
        {gameEnded && (
          <GameEndOverlay
            finalScores={gameEnded.finalScores}
            rankings={gameEnded.rankings}
            winner={gameEnded.winner}
            myUserId={userId}
            onClose={() => router.push('/dashboard')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}