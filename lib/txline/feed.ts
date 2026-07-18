import { hub } from "./hub";
import { historyFor } from "./replay";
import { isEndedStatus } from "./normalize";
import type { MatchEvent, ProbPoint } from "./types";

export interface FeedMoment {
  id: string;
  fixtureId: number;
  home: string;
  away: string;
  kind: MatchEvent["kind"];
  label: string;
  minute?: number;
  side?: "home" | "away";
  delta?: number;
  ts: number;
  scoreHome: number;
  scoreAway: number;
  finalHome: number;
  finalAway: number;
  /** small window of win-probability around the moment, for the sparkline */
  spark: ProbPoint[];
}

const SPICE: Partial<Record<MatchEvent["kind"], number>> = {
  goal: 100,
  goal_disallowed: 95,
  card_red: 90,
  penalty: 85,
  shift: 60,
  var: 50,
};

let cache: { at: number; moments: FeedMoment[] } | null = null;

/** All dramatic moments across finished matches, spiciest first. */
export function buildFeed(): FeedMoment[] {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.moments;

  const moments: FeedMoment[] = [];
  for (const match of hub.matches.values()) {
    const finished =
      isEndedStatus(match.statusId) || match.startTime < Date.now() - 3 * 3600000;
    if (!finished) continue;
    const history = historyFor(match);
    if (!history) continue;

    const goals = history.events.filter((e) => e.kind === "goal");
    const disallowed = history.events.filter((e) => e.kind === "goal_disallowed");
    const scoreAt = (ts: number): [number, number] => {
      let h = 0;
      let a = 0;
      for (const g of goals) {
        if (g.ts > ts) continue;
        if (g.side === "home") h++;
        else a++;
      }
      for (const d of disallowed) {
        if (d.ts > ts) continue;
        if (d.side === "home") h--;
        else a--;
      }
      return [Math.max(0, h), Math.max(0, a)];
    };

    for (const e of history.events) {
      const spice = SPICE[e.kind];
      if (spice === undefined) continue;
      if (e.kind === "shift" && Math.abs(e.delta ?? 0) < 10) continue;

      const from = e.ts - 6 * 60000;
      const to = e.ts + 6 * 60000;
      let spark = history.probs.filter((p) => p.ts >= from && p.ts <= to);
      if (spark.length > 40) {
        const step = Math.ceil(spark.length / 40);
        spark = spark.filter((_, i) => i % step === 0);
      }
      // Goal labels carry the authoritative score; reconstruct otherwise
      let [scoreHome, scoreAway] = scoreAt(e.ts);
      const fromLabel = e.label.match(/(\d+)–(\d+)/);
      if (fromLabel && (e.kind === "goal" || e.kind === "goal_disallowed")) {
        scoreHome = Number(fromLabel[1]);
        scoreAway = Number(fromLabel[2]);
      }
      moments.push({
        id: e.id,
        fixtureId: match.fixtureId,
        home: match.home,
        away: match.away,
        kind: e.kind,
        label: e.label,
        minute: e.minute,
        side: e.side,
        delta: e.delta,
        ts: e.ts,
        scoreHome,
        scoreAway,
        finalHome: match.scoreHome,
        finalAway: match.scoreAway,
        spark,
      });
    }
  }

  moments.sort((a, b) => {
    const sa = (SPICE[a.kind] ?? 0) + Math.min(30, Math.abs(a.delta ?? 0));
    const sb = (SPICE[b.kind] ?? 0) + Math.min(30, Math.abs(b.delta ?? 0));
    if (sb !== sa) return sb - sa;
    return b.ts - a.ts;
  });

  // Interleave so consecutive cards come from different matches
  const byMatch = new Map<number, FeedMoment[]>();
  for (const m of moments) {
    const list = byMatch.get(m.fixtureId) ?? [];
    list.push(m);
    byMatch.set(m.fixtureId, list);
  }
  const interleaved: FeedMoment[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const list of byMatch.values()) {
      const next = list.shift();
      if (next) {
        interleaved.push(next);
        added = true;
      }
    }
  }

  cache = { at: Date.now(), moments: interleaved };
  return interleaved;
}
