// src/app/api/auth/[...nextauth]/route.ts
//export { GET, POST } from '@/lib/auth';
export async function GET() {
  return Response.json({ message: "Auth temporarily disabled" });
}

export async function POST() {
  return Response.json({ message: "Auth temporarily disabled" });
}