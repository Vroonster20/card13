// src/components/shared/SignOutButton.tsx
'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      className="text-green-400 hover:text-white hover:bg-green-800"
    >
      <LogOut className="w-4 h-4 mr-1" />
      Sign Out
    </Button>
  );
}