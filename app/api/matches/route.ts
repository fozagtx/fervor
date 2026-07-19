import { NextRequest, NextResponse } from "next/server";
import { dramaScore } from "@/lib/drama";
import { hub } from "@/lib/txline/hub";
import { historyFor } from "@/lib/txline/replay";
import type { MatchState } from "@/lib/txline/types";

export const dynamic = "force-dynamic";

function isFinished(m: MatchState): boolean {
  return /(ft|full|final|ended|finish)/i.test(m.gameState);
}

export async function GET(req: NextRequest) {
  await hub.start();
  const teamsFilter = (req.nextUrl.searchParams.get("teams") || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  let matches = hub.snapshot().map((m) => {
    let probs = m.probs;
    let events = m.events;
    let seriesSource = m.probs;

    // Finished fixtures often have an empty live buffer — hydrate from recordings
    // so the lobby / island can show the wave before replay / recap.
    if (isFinished(m) && m.probs.length < 8) {
      const history = historyFor(m);
      if (history && history.probs.length > 0) {
        seriesSource = history.probs;
        events = history.events;
      }
    }

    const stride = Math.max(1, Math.ceil(seriesSource.length / 80));
    const wave = seriesSource.filter(
      (_, i) => i % stride === 0 || i === seriesSource.length - 1
    );
    // Prefer the wave series as probs so clients render the chart without a second fetch.
    probs = wave.length > 0 ? wave : probs;
    const enriched: MatchState = { ...m, probs: seriesSource, events };
    return {
      ...m,
      drama: dramaScore(enriched),
      probs,
      series: wave,
      events: events.slice(-5),
      replayable: isFinished(m) && seriesSource.length > 5,
    };
  });

  if (teamsFilter.length > 0) {
    matches = matches.filter(
      (m) =>
        teamsFilter.includes(m.home.toLowerCase()) || teamsFilter.includes(m.away.toLowerCase())
    );
  }

  return NextResponse.json({ matches, error: hub.lastError });
}
