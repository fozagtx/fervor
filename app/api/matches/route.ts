import { NextResponse } from "next/server";
import { hub } from "@/lib/txline/hub";

export const dynamic = "force-dynamic";

export async function GET() {
  await hub.start();
  const matches = hub.snapshot().map((m) => ({
    ...m,
    probs: m.probs.slice(-1), // list view only needs the latest point
    events: m.events.slice(-3),
  }));
  return NextResponse.json({ matches, error: hub.lastError });
}
