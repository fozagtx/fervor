import { NextResponse } from "next/server";
import { hub } from "@/lib/txline/hub";
import { historyFor } from "@/lib/txline/replay";

export const dynamic = "force-dynamic";

/** Full recorded history of a finished match for instant chart display. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  await hub.start();
  const { fixtureId } = await params;
  const match = hub.matches.get(Number(fixtureId));
  if (!match) {
    return NextResponse.json({ error: "unknown fixture" }, { status: 404 });
  }
  const history = historyFor(match);
  if (!history) {
    return NextResponse.json({ error: "no recorded history" }, { status: 404 });
  }
  return NextResponse.json(history);
}
