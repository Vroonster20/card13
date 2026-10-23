import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");

  if (secret !== process.env.ADMIN_CLEANUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const guests = await prisma.user.findMany({
    where: {
      isGuest: true,
      createdAt: {
        lt: cutoff,
      },
    },
    include: {
      hostedGames: {
        include: {
          players: {
            include: {
              user: true,
            },
          }
        }
      }
    }
  });

  let deletedGuests = 0;
  let transferredGames = 0;
  let deletedGames = 0;

  for (const guest of guests) {
    await prisma.$transaction(async (tx) => {
      for (const game of guest.hostedGames) {
        const newHost = game.players.find(player => !player.user.isGuest);

        if (newHost) {
          await tx.game.update({
            where: { id: game.id },
            data: { hostId: newHost.userId },
          });
          transferredGames++;
        }
        else {
          await tx.game.delete({
            where: { id: game.id },
          });
          deletedGames++;
        }
      }

      await tx.user.delete({
        where: { id: guest.id },
      });
      deletedGuests++;
    });
  }

  return NextResponse.json({ deletedGuests, transferredGames, deletedGames });
}