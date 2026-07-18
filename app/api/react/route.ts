import { NextRequest, NextResponse } from "next/server";
import { addReaction, allowReaction, type ReactionKind } from "@/lib/reactions";

export const dynamic = "force-dynamic";

const KINDS: ReactionKind[] = ["fire", "shock", "ball"];

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowReaction(ip)) {
    return NextResponse.json({ error: "slow down" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { id?: string; kind?: string } | null;
  if (!body?.id || !KINDS.includes(body.kind as ReactionKind) || body.id.length > 80) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const counts = addReaction(body.id, body.kind as ReactionKind);
  return NextResponse.json({ counts });
}
