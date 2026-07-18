import { NextResponse } from "next/server";
import { hub } from "@/lib/txline/hub";
import { buildFeed } from "@/lib/txline/feed";
import { getReactions } from "@/lib/reactions";

export const dynamic = "force-dynamic";

export async function GET() {
  await hub.start();
  const moments = buildFeed();
  const reactions = getReactions(moments.map((m) => m.id));
  return NextResponse.json({ moments, reactions });
}
