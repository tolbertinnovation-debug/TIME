import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// For uptime monitoring: answers 200 when the app and its database are both working.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
