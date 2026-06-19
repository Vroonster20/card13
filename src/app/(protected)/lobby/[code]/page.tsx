// ─────────────────────────────────────────────
// src/app/(protected)/lobby/[code]/page.tsx
// ─────────────────────────────────────────────
import { LobbyRoom } from '@/components/lobby/LobbyRoom';

export default function LobbyCodePage({ params }: { params: { code: string } }) {
  return <LobbyRoom lobbyCode={params.code} />;
}