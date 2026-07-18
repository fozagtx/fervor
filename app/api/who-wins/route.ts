import { NextRequest, NextResponse } from "next/server";
import { castVote, getPoll, publicPoll, type Side } from "@/lib/whoWinsStore";

export const dynamic = "force-dynamic";

const SIDES: Side[] = ["home", "draw", "away"];

export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("fixture"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "fixture required" }, { status: 400 });
  }
  return NextResponse.json({ fixtureId: id, ...publicPoll(getPoll(id)) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    fixtureId?: number;
    side?: string;
    player?: string;
  } | null;
  const fixtureId = Number(body?.fixtureId);
  const side = body?.side as Side;
  const player = (body?.player || "").trim().slice(0, 40);
  if (!Number.isFinite(fixtureId) || fixtureId <= 0 || !SIDES.includes(side) || player.length < 4) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const result = castVote(fixtureId, player, side);
  return NextResponse.json({ fixtureId, ...result, yours: side });
}
