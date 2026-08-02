// ─────────────────────────────────────────────
// src/app/page.tsx — Landing Page
// ─────────────────────────────────────────────
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AuthButtons } from '@/components/auth/AuthButtons';

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-lg">
        <div className="text-8xl mb-6 animate-bounce">🃏</div>
        <h1 className="text-5xl font-extrabold text-white mb-4">Card 13</h1>
        <p className="text-green-300 text-lg mb-8">
          The classic card game with wilds, sets, and runs. Play with up to 7 friends online in real-time.
        </p>
        <AuthButtons />
        <div className="mt-12 grid grid-cols-3 gap-6 text-center">
          {[
            { icon: '👥', label: 'Up to 7 Players' },
            { icon: '🔄', label: '11 Rounds' },
            { icon: '🃏', label: 'Wild Cards' },
          ].map(item => (
            <div key={item.label} className="bg-green-900/50 rounded-2xl p-4 border border-green-800">
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="text-sm text-green-300">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}