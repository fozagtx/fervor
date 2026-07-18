import { NextResponse } from "next/server";
import { hub } from "@/lib/txline/hub";

export const dynamic = "force-dynamic";

export async function GET() {
  await hub.start();
  const matches = hub.snapshot().map((m) => {
    const stride = Math.max(1, Math.ceil(m.probs.length / 40));
    return {
      ...m,
      probs: m.probs.slice(-1), // list view only needs the latest point
      series: m.probs.filter((_, i) => i % stride === 0 || i === m.probs.length - 1),
      events: m.events.slice(-3),
    };
  });
  return NextResponse.json({ matches, error: hub.lastError });
}
