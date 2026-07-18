import type { MatchEvent, MatchState, ProbPoint } from "@/lib/txline/types";

/**
 * Drama score, 0–100: how much is happening in this match right now.
 * Blends recent market volatility (how violently win probability is moving)
 * with a decaying pulse from high-impact events.
 */
export function dramaScore(match: MatchState, nowTs?: number): number {
  const probs = match.probs;
  if (probs.length < 3) return 0;
  const now = nowTs ?? probs[probs.length - 1].ts;

  // Market volatility: sum of absolute home-prob moves over the last 10 min,
  // weighted toward the most recent moves.
  const windowMs = 10 * 60 * 1000;
  const recent = probs.filter((p) => now - p.ts <= windowMs);
  let volatility = 0;
  for (let i = 1; i < recent.length; i++) {
    const age = (now - recent[i].ts) / windowMs; // 0 fresh → 1 old
    const weight = 1 - 0.6 * age;
    volatility += Math.abs(recent[i].home - recent[i - 1].home) * weight;
  }
  // ~20pp of cumulative weighted movement in 10 min = wild market
  const volScore = Math.min(60, (volatility / 20) * 60);

  // Event pulses: each big moment adds a spike that decays over 8 minutes.
  const pulseOf: Partial<Record<MatchEvent["kind"], number>> = {
    goal: 40,
    goal_disallowed: 35,
    penalty: 35,
    card_red: 30,
    var: 20,
    shift: 15,
  };
  let pulse = 0;
  for (const e of match.events) {
    const base = pulseOf[e.kind];
    if (!base) continue;
    const age = now - e.ts;
    if (age < 0 || age > 8 * 60 * 1000) continue;
    pulse += base * (1 - age / (8 * 60 * 1000));
  }

  // Closeness bonus: a tight three-way market is inherently tenser.
  const last = probs[probs.length - 1];
  const spread = Math.abs(last.home - last.away);
  const closeness = Math.max(0, 10 - spread / 4);

  return Math.round(Math.min(100, volScore + Math.min(45, pulse) + closeness));
}

/** Biggest swing in any 5-minute window: [delta pp, side, endTs]. */
export function biggestSwing(
  probs: ProbPoint[]
): { delta: number; side: "home" | "away"; ts: number } | null {
  if (probs.length < 2) return null;
  let best: { delta: number; side: "home" | "away"; ts: number } | null = null;
  let start = 0;
  for (let end = 1; end < probs.length; end++) {
    while (probs[end].ts - probs[start].ts > 5 * 60 * 1000) start++;
    const dHome = probs[end].home - probs[start].home;
    const dAway = probs[end].away - probs[start].away;
    const side = Math.abs(dHome) >= Math.abs(dAway) ? "home" : "away";
    const delta = side === "home" ? dHome : dAway;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { delta: Math.round(delta * 10) / 10, side, ts: probs[end].ts };
    }
  }
  return best;
}

/** Peak drama over the whole match (sampled), for recap cards. */
export function dramaPeak(match: MatchState): number {
  const probs = match.probs;
  if (probs.length < 10) return dramaScore(match);
  let peak = 0;
  const step = Math.max(1, Math.floor(probs.length / 60));
  for (let i = 10; i < probs.length; i += step) {
    peak = Math.max(peak, dramaScore(match, probs[i].ts));
  }
  return peak;
}
