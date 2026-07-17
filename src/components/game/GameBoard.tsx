'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent, closestCenter, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable, } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { Wand2 } from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface GroupedCard extends Card {
  location: 'hand' | 'group';
  groupId?: number; // only set when location === 'group'
}

interface Group {
  id: number;
}

interface GameBoardProps {
  gameId: string;
}

// ─────────────────────────────────────────────
// GroupDropZone — inline so it can use hooks
// ─────────────────────────────────────────────

function GroupDropZone({
  group,
  cards,
  canDiscard,
  onDiscard,
  wildRank,
  isOver,
}: {
  group: Group;
  cards: GroupedCard[];
  canDiscard: boolean;
  onDiscard: (id: string) => void;
  wildRank: string;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `group-${group.id}` });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-w-32 min-h-42 rounded-xl border-2 border-dashed p-2 flex flex-col items-center
        transition-colors duration-150
        ${isOver
          ? 'border-yellow-400 bg-yellow-400/10'
          : 'border-green-600 bg-green-900/40'}
      `}
    >
      <span className="text-xs text-green-400 mb-2 font-medium">
        Group {group.id}
      </span>

      {cards.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-green-700 text-xs">Drop cards here</span>
        </div>
      ) : (
        <div className="flex gap-1 flex-wrap justify-center">
          {cards.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              isInGroup
              canDiscard={canDiscard}
              onDiscard={onDiscard}
              wildRank={wildRank as any}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// HandDropZone
// ─────────────────────────────────────────────

function HandDropZone({
  children,
  isOver,
}: {
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: 'hand' });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex gap-1 justify-center flex-wrap min-h-24 rounded-xl transition-colors duration-150 p-1
        ${isOver ? 'bg-green-700/30 ring-1 ring-green-500' : ''}
      `}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// GameBoard
// ─────────────────────────────────────────────

export function GameBoard({ gameId }: GameBoardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id ?? '';

  const { gameState, roundEnded, gameEnded, error, setError } = useGameStore();
  const lobbyState = useGameStore((s) => s.lobbyState);
  const socket = useSocket();

  // ── Unified card state ──
  const [cards, setCards] = useState<GroupedCard[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeCard, setActiveCard] = useState<GroupedCard | null>(null);
  const [overZoneId, setOverZoneId] = useState<string | null>(null);

  // For detected runs/sets (highlight only, not grouping)
  const [detectedGroups, setDetectedGroups] = useState<CardGroup[]>([]);
  const [showHighlight, setShowHighlight] = useState(false);

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Derived views ──
  const handCards = cards.filter((c) => c.location === 'hand');
  const cardsInGroup = (groupId: number) =>
    cards.filter((c) => c.location === 'group' && c.groupId === groupId);
  

  // ── Socket connection ──
  useEffect(() => {
    socket.connect();
    socket.reconnect(lobbyState?.code ?? '', userId);
    return () => socket.disconnect();
  }, []);

  // ── Sync from server ──
  useEffect(() => {
    if (!gameState?.myHand) return;

    const markedHand = markWilds(
      gameState.myHand,
      gameState.currentRound.wildRank
    );

    // Preserve group assignments for cards that are still in hand
    setCards((prev) => {
      const serverById = new Map(markedHand.map(c => [c.id, c]));
      const merged = prev.filter(c => serverById.has(c.id)).map(c => ({ ...serverById.get(c.id)!, location: c.location, groupId: c.groupId }));
      const existingIds = new Set(merged.map(c => c.id));  

      for (const card of markedHand) {
        if (!existingIds.has(card.id)) {
          merged.push({ ...card, location: 'hand', groupId: undefined });
        }
      }
      return merged;
    });

    detectGroups(markedHand, gameState.currentRound.wildRank);
  }, [gameState?.myHand, gameState?.currentRound.wildRank]);

  // ── Auto-clear errors ──
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(t);
  }, [error, setError]);

  const detectGroups = useCallback((hand: Card[], wildRank: string) => {
    const marked = markWilds(hand, wildRank as any);
    const { groups } = findBestArrangement(marked);
    setDetectedGroups(groups);
  }, []);

  // ─────────────────────────────────────────────
  // Drag handlers
  // ─────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverZoneId(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    setOverZoneId(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const draggedCard = cards.find((c) => c.id === activeId);
    if (!draggedCard) return;

    // ── Drop onto a group zone ──
    if (overId.startsWith('group-')) {
      const groupId = Number(overId.replace('group-', ''));
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, location: 'group', groupId }
            : c
        )
      );
      syncHandToServer();
      return;
    }

    // ── Drop onto hand zone ──
    if (overId === 'hand') {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, location: 'hand', groupId: undefined }
            : c
        )
      );
      syncHandToServer();
      return;
    }

    // ── Drop onto another card (reorder within hand) ──
    const overCard = cards.find((c) => c.id === overId);
    if (!overCard) return;

    // Both in hand → reorder
    if (draggedCard.location === 'hand' && overCard.location === 'hand') {
      setCards((prev) => {
        const handOnly = prev.filter((c) => c.location === 'hand');
        const rest = prev.filter((c) => c.location !== 'hand');
        const oldIdx = handOnly.findIndex((c) => c.id === activeId);
        const newIdx = handOnly.findIndex((c) => c.id === overId);
        const reordered = arrayMove(handOnly, oldIdx, newIdx);
        return [...reordered, ...rest];
      });
      syncHandToServer();
      return;
    }

    // Both in same group → reorder within group
    if (
      draggedCard.location === 'group' &&
      overCard.location === 'group' &&
      draggedCard.groupId === overCard.groupId
    ) {
      setCards((prev) => {
        const groupId = draggedCard.groupId!;
        const inGroup = prev.filter(
          (c) => c.location === 'group' && c.groupId === groupId
        );
        const rest = prev.filter(
          (c) => !(c.location === 'group' && c.groupId === groupId)
        );
        const oldIdx = inGroup.findIndex((c) => c.id === activeId);
        const newIdx = inGroup.findIndex((c) => c.id === overId);
        const reordered = arrayMove(inGroup, oldIdx, newIdx);
        return [...rest, ...reordered];
      });
      return;
    }

    // Dragged from group onto a card in another group → move to that group
    if (draggedCard.location === 'group' && overCard.location === 'group') {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, groupId: overCard.groupId }
            : c
        )
      );
      return;
    }

    // Dragged from group onto a hand card → move back to hand
    if (draggedCard.location === 'group' && overCard.location === 'hand') {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, location: 'hand', groupId: undefined }
            : c
        )
      );
      syncHandToServer();
    }
  };

  // Only sync the hand (ungrouped) cards to the server for arrangement
  const syncHandToServer = useCallback(() => {
    const hand = cards.filter((c) => c.location === 'hand');
    socket.arrangeHand(gameId, userId, hand);
  }, [cards, gameId, userId, socket]);

  // ─────────────────────────────────────────────
  // Group management
  // ─────────────────────────────────────────────

  const [isManagingGroups, setIsManagingGroups] = useState(false);

  function getMaxGroups(cardsDealt: number): number {
    return Math.min(4, Math.floor(cardsDealt / 3));
  }

  const handleAddGroup = () => {
    if (groups.length >= maxGroups) return;
    const newId = groups.length === 0 ? 1 : Math.max(...groups.map((g) => g.id)) + 1;
    setGroups((prev) => [...prev, { id: newId }]);
  };

  const handleDeleteGroup = () => {
    if (groups.length === 0) return;
    const lastGroup = groups[groups.length - 1];
    // Return that group's cards back to hand
    setCards((prev) =>
      prev.map((c) =>
        c.location === 'group' && c.groupId === lastGroup.id
          ? { ...c, location: 'hand', groupId: undefined }
          : c
      )
    );
    setGroups((prev) => prev.slice(0, -1));
  };

  // ─────────────────────────────────────────────
  // Game actions
  // ─────────────────────────────────────────────

  const handleDrawDeck = () => socket.drawFromDeck(gameId, userId);
  const handleDrawDiscard = () => socket.drawFromDiscard(gameId, userId);
  const handleDiscard = (cardId: string) => socket.discardCard(gameId, userId, cardId);
  const handleKnock = () => socket.knock(gameId, userId);
  const handleEndTurn = () => socket.endTurn(gameId, userId);

  // ─────────────────────────────────────────────
  // Render guard
  // ─────────────────────────────────────────────

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-green-950">
        <div className="animate-spin h-12 w-12 rounded-full border-4 border-green-400 border-t-transparent" />
      </div>
    );
  }

  const isMyTurn = gameState.currentTurnUserId === userId;
  const canDraw = isMyTurn && !gameState.hasDrewThisTurn;
  const canDiscard = isMyTurn && gameState.hasDrewThisTurn && !gameState.hasDiscardedThisTurn && !isManagingGroups;
  const wildRank = gameState.currentRound.wildRank;
  const maxGroups = getMaxGroups(gameState.currentRound.cardsDealt);

  const cardIsHighlighted = (card: Card) =>
    showHighlight && detectedGroups.some((g) => g.cards.some((c) => c.id === card.id));

  // ─────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-green-950 text-white flex flex-col">

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-green-900/60 backdrop-blur border-b border-green-800">
        <WildCardDisplay
          wildRank={wildRank}
          roundNumber={gameState.currentRound.roundNumber}
        />
        <TurnIndicator
          players={gameState.players}
          currentTurnUserId={gameState.currentTurnUserId}
          myUserId={userId}
        />
        <ScoreBoard
          players={gameState.players}
          scores={gameState.cumulativeScores}
        />
      </div>

      {/* Final Turn Banner */}
      {gameState?.isFinalTurnPhase && (
        <div className="bg-yellow-700/90 text-white text-sm font-medium text-center py-2 px-4">
          ⚠️ Final Turns — score your hand!
        </div>
      )}

      {/* Other Players */}
      <div className="flex justify-center gap-8 py-4 px-4 flex-wrap">
        {gameState.players
          .filter((p) => p.userId !== userId)
          .map((player) => (
            <motion.div
              key={player.userId}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 ${
                gameState.currentTurnUserId === player.userId
                  ? 'ring-2 ring-yellow-400'
                  : ''
              }`}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: player.handCount }).map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-12 bg-blue-800 border border-blue-600 rounded-md shadow"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-green-300 truncate max-w-20">
                {player.name}
              </span>
              {!player.isConnected && (
                <Badge variant="destructive" className="text-xs">
                  Disconnected
                </Badge>
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

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 25 }}
            className="fixed bottom-40 left-1/2 -translate-x-1/2 bg-red-900 text-red-100 px-4 py-2 rounded-lg text-sm shadow-lg z-50"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hand Area */}
      <div className="bg-green-900/80 border-t border-green-700 p-4">

        {/* Controls */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleKnock}
              disabled={!isMyTurn || !gameState.hasDiscardedThisTurn}
              className="bg-yellow-600 hover:bg-yellow-500 text-black disabled:opacity-40"
            >
              Knock
            </Button>
            <Button
              size="sm"
              onClick={handleEndTurn}
              disabled={!isMyTurn || !gameState.hasDiscardedThisTurn}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
            >
              End Turn
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsManagingGroups((p) => !p)}
              className="text-green-100 border-green-600 hover:bg-green-800"
            >
              <Wand2 className="w-4 h-4 mr-1" />
              {isManagingGroups ? 'Close Groups' : 'Manage Groups'}
            </Button>
            {isManagingGroups && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddGroup}
                  disabled={groups.length >= maxGroups}
                  className="text-green-100 border-green-600 hover:bg-green-800 disabled:opacity-40"
                >
                  + Group ({groups.length}/{maxGroups})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeleteGroup}
                  disabled={groups.length === 0}
                  className="text-red-300 border-red-700 hover:bg-red-900 disabled:opacity-40"
                >
                  − Group
                </Button>
              </>
            )}
          </div>

          <div className="text-sm text-green-300">
            {isMyTurn
              ? canDraw
                ? '🃏 Draw a card'
                : '🗑️ Discard a card'
              : '⏳ Waiting...'}
          </div>
        </div>

        {/* DnD Context wraps BOTH groups and hand */}
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >

          {/* Group Drop Zones */}
          {isManagingGroups && groups.length > 0 && (
            <div className="flex gap-3 justify-center mb-4 flex-wrap">
              {groups.map((group) => (
                <GroupDropZone
                  key={group.id}
                  group={group}
                  cards={cardsInGroup(group.id)}
                  canDiscard={canDiscard}
                  onDiscard={handleDiscard}
                  wildRank={wildRank}
                  isOver={overZoneId === `group-${group.id}`}
                />
              ))}
            </div>
          )}

          {/* Hand */}
          <SortableContext
            items={handCards.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <HandDropZone isOver={overZoneId === 'hand'}>
              {handCards.map((card) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  isInGroup={cardIsHighlighted(card)}
                  canDiscard={canDiscard}
                  onDiscard={handleDiscard}
                  wildRank={wildRank as any}
                />
              ))}
              {handCards.length === 0 && (
                <div className="text-green-700 text-sm self-center">
                  Hand is empty
                </div>
              )}
            </HandDropZone>
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeCard ? (
              <CardComponent
                card={activeCard}
                isInGroup={false}
                canDiscard={false}
                onDiscard={() => {}}
                wildRank={wildRank as any}
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