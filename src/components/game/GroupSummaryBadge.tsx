// src/components/game/GroupSummaryBadge.tsx
'use client';

interface GroupSummaryBadgeProps {
    groupId: number;
    cards: { rank: string; isWild?: boolean }[];
    //isValid: boolean;
}

export function GroupSummaryBadge({ groupId, cards }: GroupSummaryBadgeProps) {
    if (cards.length === 0) return null;
    
    return (
        <div className="px-3 py-2 -mt-0 rounded-full border text-sm font-mono whitespace-nowrap">
            <span className="text-green-400 mr-1.5">G{groupId}</span>
            {cards.map((c, i) => (
                <span key={i}>
                    <span className={c.isWild ? 'text-purple-400' : ''}>
                        {c.rank}
                    </span>
                    {i < cards.length - 1 && ', '}
                </span>
            ))}
        </div>
    );
}