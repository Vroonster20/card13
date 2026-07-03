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
import GroupDropZone from './GroupDropZone';

interface GameBoardProps {
  gameId: string;
}

interface GroupedCard extends Card {
  location: 'hand' | 'group';
  groupId?: number;
}

export function GameBoard({ gameId }: GameBoardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id ?? '';

  const { gameState, roundEnded, gameEnded, error, setError } = useGameStore();
  const lobbyState = useGameStore(state => state.lobbyState);
  const socket = useSocket();

  const [localHand, setLocalHand] = useState<Card[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [cards, setCards] = useState<GroupedCard[]>([]); //this is new

  const [detectedGroups, setDetectedGroups] = useState<CardGroup[]>([]); //This is for determining runs, not related to grouping.
  const [autoSort, setAutoSort] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handCards = cards.filter(c => c.location === 'hand');
  const groupCards = cards.filter(c => c.location === 'group' && c.groupId === undefined);

  // Connect socket on mount
  useEffect(() => {
    socket.connect();
    socket.reconnect(lobbyState?.code ?? '', userId); // lobbyCode fetched from URL/store
    return () => socket.disconnect();
  }, []);

  // Sync hand from server state
  useEffect(() => {
    if (gameState?.myHand) {
        const markedHand = markWilds(
            gameState.myHand,
            gameState.currentRound.wildRank
        );

        //setLocalHand(markedHand);
        setCards(markedHand.map(card => ({ ...card, location: 'hand', groupId: undefined })));
        detectGroups(markedHand, gameState.currentRound.wildRank);
    }
  }, [
      gameState?.myHand,
      gameState?.currentRound.wildRank,
  ]);

  // Make errors disappear after 3 seconds
  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      setError(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [error, setError]);

  const detectGroups = useCallback((hand: Card[], wildRank: string) => {
    const marked = markWilds(hand, wildRank as any);
    const { groups } = findBestArrangement(marked);
    setDetectedGroups(groups);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find(c => c.id === event.active.id);
    setActiveCard(card ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {

    setActiveCard(null);
    const { active, over } = event;

    if (!over) {
      console.log('Dropped outside any drop zone');
      return;
    }

    if (typeof over.id === 'string' && over.id.startsWith('group-')) {
      const groupId = Number(over.id.replace('group-', ''));

      const draggedCard = cards.find(c => c.id === active.id);
      if (!draggedCard) return;

      const updatedHand = localHand.filter(c => c.id !== active.id);
      setLocalHand(updatedHand);

      setGroups(prev => prev.map(group => group.id === groupId ? { ...group, cards: [...group.cards, draggedCard] } : group));

      alert(localHand.map(card => ({id: card?.id, rank: card?.rank,})));

      return;
    }

    if (active.id === over.id) return;

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
  const handleKnock = () => {socket.knock(gameId, userId);};
  const handleEndTurn = () => {socket.endTurn(gameId, userId);};

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

  const [isManagingGroups, setIsManagingGroups] = useState(false);
  const handleToggle = () => setIsManagingGroups(prev => !prev);

  const [groups, setGroups] = useState<{ id: number; cards: any[] }[]>([]); //this is new
  const handleAddGroup = () => {
    if (groups.length >= 4) return; // Limit to 4 groups

    setGroups([...groups, {id: groups.length + 1, cards: []}]);
  };
  const handleDeleteGroup = () => {
    if (groups.length === 0) return; // No groups to delete

    setGroups(groups.slice(0, -1));
  };

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

      {gameState?.isFinalTurnPhase && (
        <div className="bg-yellow-700 text-white p-3 rounded mb-4">
          Final Turns Active
        </div>
      )} 

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
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 25 }}
            className="fixed bottom-40 left-1/2 -translate-x-1/2 bg-red-900 text-red-100 px-4 py-2 rounded-lg text-sm shadow-lg"
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
            {/* I deleted Auto Sort and Highlight Groups buttons, yet 
                their functionality may be useful in the future.
                Auto Sort called handleAutoSort, Highlight Groups toggled autoSort state */}
            <Button
              onClick={handleKnock}
              disabled={gameState?.currentTurnUserId !== userId || !gameState.hasDiscardedThisTurn}
            >
              Knock
            </Button>
            <Button
              onClick={handleEndTurn}
              disabled={gameState?.currentTurnUserId !== userId || !gameState.hasDiscardedThisTurn}
            >
              End Turn
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggle}
              className={`text-green-100 border-green-600 ${autoSort ? 'bg-green-700' : 'hover:bg-green-800'}`}
            >
              <Wand2 className="w-4 h-4 mr-1" />
              {isManagingGroups ? 'Close Grouping' : 'Manage Grouping'}
            </Button>
            {isManagingGroups && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddGroup}
              className={`text-green-100 border-green-600 ${autoSort ? 'bg-green-700' : 'hover:bg-green-800'}`}
            >
              + Add Group
            </Button>)}
            {isManagingGroups && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeleteGroup}
              className={`text-green-100 border-green-600 ${autoSort ? 'bg-green-700' : 'hover:bg-green-800'}`}
            >
              - Delete Group
            </Button>)}
          </div>
          <div className="text-sm text-green-300">
            {isMyTurn
              ? canDraw
                ? '🃏 Draw a card'
                : '🗑️ Discard a card'
              : '⏳ Waiting...'}
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >

        {/* Groups */}
        {isManagingGroups && (
          <div className="mt-4 mb-6 flex justify-center gap-3">
            {groups.map(group => (
              <GroupDropZone
                key={group.id}
                id={`group-${group.id}`}
                title={`Group ${group.id}`}
              >
                {group.cards.length === 0 ? (
                  <div className="mt-2 text-green-400 text-sm">
                    Drag here
                  </div>
                ) : (
                  <div className="flex gap-1 justify-center flex-wrap min-h-24">
                    {cards.filter(c => c.groupId === group.id).map(card => (
                      <CardComponent
                        key={card.id}
                        card={card}
                        isInGroup={true}
                        canDiscard={canDiscard}
                        onDiscard={handleDiscard}
                        wildRank={wildRank}
                    />
                  ))}
                  </div>
                )}
              </GroupDropZone>
            ))}
          </div>
        )}

        {/* Draggable Hand */}
          <SortableContext
            items={localHand}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-1 justify-center flex-wrap min-h-24">
              {cards.filter(c => c.location === 'hand').map((card) => (
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