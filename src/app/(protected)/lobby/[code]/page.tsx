// ─────────────────────────────────────────────
// src/app/(protected)/lobby/[code]/page.tsx
// ─────────────────────────────────────────────
import { LobbyRoom } from '@/components/lobby/LobbyRoom';

export default async function LobbyCodePage({ params }: { params: { code: string } }) {
  const { code } = await params;
  return <LobbyRoom lobbyCode={code} />;
}