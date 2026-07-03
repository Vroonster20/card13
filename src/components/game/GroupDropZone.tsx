import { useDroppable } from '@dnd-kit/core';

interface Props {
    id: string;
    title: string;
    children?: React.ReactNode;
}

export default function GroupDropZone({ id, title, children }: Props) {
    const { isOver, setNodeRef } = useDroppable({
        id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`rounded-lg border-2 p-4 min-w-56 min-h-36 transition-colors
                ${
                isOver
                    ? 'border-green-400 bg-green-900/40'
                    : 'border-dashed border-green-600'
                }`}
            >
            <h3 className="text-green-200 font-semibold">
                {title}
            </h3>

            <div className="mt-2">
                {children}
            </div>
            </div>
        );
}