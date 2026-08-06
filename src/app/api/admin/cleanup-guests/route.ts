import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");

  if (secret !== process.env.ADMIN_CLEANUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.user.deleteMany({
    where: {
      isGuest: true,
      createdAt: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  return NextResponse.json({
    deleted: result.count,
  });
}