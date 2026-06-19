// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
//import { SessionProvider } from 'next-auth/react';
//import { ThemeProvider } from 'next-themes';
import { Providers } from "@/components/providers";
//import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Card 13 — Multiplayer Card Game',
  description: 'Play the card game "13" with up to 7 players online',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}