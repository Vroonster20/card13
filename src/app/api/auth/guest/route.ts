import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signIn } from 'next-auth/react';

export async function POST() {
  const guestNumber = Math.floor(1000 + Math.random() * 9000);

  const guest = await prisma.user.create({
    data: {
      name: `Guest${guestNumber}`,
      isGuest: true,
      email: null,
      password: null,
      image: null,
    },
  });

  return NextResponse.json({
    success: true,
    userId: guest.id,
    name: guest.name,
  });

  await signIn('guest', {
    userId: guest.id,
    redirect: false,
  });
}