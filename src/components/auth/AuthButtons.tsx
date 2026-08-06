'use client';

import { Button } from '@/components/ui/button';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export function AuthButtons() {
    const handleGuest = async () => {
        const res = await fetch('/api/auth/guest', {
        method: 'POST',
        });

        const { userId } = await res.json();

        await signIn('guest', {
        userId,
        callbackUrl: '/',
        });
    };
    return (
        <div>
            <div className="flex gap-4 justify-center flex-wrap">
                <Button asChild size="lg" className="bg-green-600 hover:bg-green-500 text-white font-semibold px-8">
                    <Link href="/register">Get Started</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-green-600 text-green-500 hover:bg-green-800 px-8">
                    <Link href="/login">Sign In</Link>
                </Button>
            </div><br />
            <div className="flex gap-4 justify-center flex-wrap">
                <Button size="lg" variant="outline" className="border-yellow-600 text-green-300 hover:bg-yellow-800 px-8" onClick={handleGuest}>
                    Continue as Guest
                </Button>
            </div>
        </div>
    );
}