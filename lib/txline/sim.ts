/**
 * Dev-only match simulator (TXLINE_SIM=1). Feeds the hub with synthetic
 * odds/scores shaped exactly like normalized TxLINE data so the UI can be
 * developed and styled without live credentials. Never enabled in production.
 */
import type { MatchState, ProbPoint } from "./types";
import { makeEvent } from "./normalize";

interface SimHubLike {
  matches: Map<number, MatchState>;
  onSimProb(fixtureId: number, point: ProbPoint): void;
  onSimScore(fixtureId: number, home: number, away: number, gameState: string, minute?: number): void;
  emitEvent(event: ReturnType<typeof makeEvent>): void;
}

const SIM_MATCHES: Array<{
  fixtureId: number;
  home: string;
  away: string;
  minutesIn: number;
  start: [number, number, number];
}> = [
  { fixtureId: 9001, home: "France", away: "Argentina", minutesIn: 34, start: [41, 27, 32] },
  { fixtureId: 9002, home: "Brazil", away: "England", minutesIn: 61, start: [28, 24, 48] },
  { fixtureId: 9003, home: "Spain", away: "Morocco", minutesIn: 0, start: [55, 25, 20] },
];

export function startSimulation(hub: SimHubLike) {
  const now = Date.now();
  for (const cfg of SIM_MATCHES) {
    const live = cfg.minutesIn > 0;
    const match: MatchState = {
      fixtureId: cfg.fixtureId,
      competition: "FIFA World Cup (sim)",
      home: cfg.home,
      away: cfg.away,
      homeId: cfg.fixtureId * 10 + 1,
      awayId: cfg.fixtureId * 10 + 2,
      startTime: now - cfg.minutesIn * 60000,
      gameState: live ? "1st Half" : "scheduled",
      scoreHome: 0,
      scoreAway: 0,
      minute: live ? cfg.minutesIn : undefined,
      probs: [],
      events: [],
      lastUpdate: now,
    };
    // Backfill history so charts have a river to show immediately
    let [h, d, a] = cfg.start;
    if (live) {
      const points = cfg.minutesIn * 6; // one point every 10s of match time
      for (let i = 0; i < points; i++) {
        [h, d, a] = drift(h, d, a);
        match.probs.push({
          ts: match.startTime + i * 10000,
          home: r1(h),
          draw: r1(d),
          away: r1(a),
        });
      }
      match.events.push(
        makeEvent({ fixtureId: cfg.fixtureId, ts: match.startTime, kind: "kickoff", label: "Kick-off" })
      );
    }
    hub.matches.set(cfg.fixtureId, match);
  }

  setInterval(() => {
    for (const cfg of SIM_MATCHES) {
      const match = hub.matches.get(cfg.fixtureId);
      if (!match || match.gameState === "scheduled") continue;
      const last = match.probs[match.probs.length - 1] || {
        home: cfg.start[0],
        draw: cfg.start[1],
        away: cfg.start[2],
      };
      const [h, d, a] = drift(last.home, last.draw, last.away);
      const point: ProbPoint = { ts: Date.now(), home: r1(h), draw: r1(d), away: r1(a) };
      hub.onSimProb(cfg.fixtureId, point);
      match.minute = Math.min(90, (match.minute || 0) + 0.05);

      if (Math.random() < 0.008) {
        const side = Math.random() < 0.5 ? "home" : "away";
        const scoreHome = match.scoreHome + (side === "home" ? 1 : 0);
        const scoreAway = match.scoreAway + (side === "away" ? 1 : 0);
        hub.onSimScore(cfg.fixtureId, scoreHome, scoreAway, match.gameState, match.minute);
      }
    }
  }, 2000);

  console.log("[sim] simulation running: 3 fixtures");
}

function drift(h: number, d: number, a: number): [number, number, number] {
  const move = (Math.random() - 0.5) * 1.6;
  h = clamp(h + move, 4, 92);
  a = clamp(a - move * (0.5 + Math.random() * 0.5), 4, 92);
  d = clamp(100 - h - a, 3, 60);
  const total = h + d + a;
  return [(h / total) * 100, (d / total) * 100, (a / total) * 100];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
