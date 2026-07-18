import fs from "fs";
import path from "path";
import { EventSource } from "eventsource";
import { API_BASE, NETWORK, RECORDINGS_DIR, WORLD_CUP_COMPETITION_ID } from "./config";
import { getAuth, renewJwt } from "./auth";
import { txGet } from "./api";
import { applyScores, fixtureToMatch, isEndedStatus, isInPlay, makeEvent, oddsToProbPoint } from "./normalize";
import type {
  MatchState,
  ProbPoint,
  StreamMessage,
  TxFixture,
  TxOddsPayload,
  TxScores,
} from "./types";

const MAX_PROB_POINTS = 4000;
const SHIFT_THRESHOLD_PP = 8;
const SHIFT_LOOKBACK_MS = 3 * 60 * 1000;
const SHIFT_DEBOUNCE_MS = 2 * 60 * 1000;

type Subscriber = (msg: StreamMessage) => void;

class MatchHub {
  matches = new Map<number, MatchState>();
  private subscribers = new Set<Subscriber>();
  private started = false;
  private lastShiftAt = new Map<number, number>();
  private seenMarkets = new Set<string>();
  lastError: string | null = null;

  async start() {
    if (this.started) return;
    this.started = true;
    if (process.env.TXLINE_SIM === "1") {
      const { startSimulation } = await import("./sim");
      startSimulation(this);
      return;
    }
    try {
      await this.loadFixtures();
      await this.openStream("odds");
      await this.openStream("scores");
      setInterval(() => this.broadcast({ type: "heartbeat", ts: Date.now() }), 25000);
      setInterval(() => this.loadFixtures().catch(() => {}), 10 * 60 * 1000);
      console.log(`[hub] started on ${NETWORK}: ${this.matches.size} fixtures`);
      void this.warmReplays();
    } catch (e) {
      this.started = false;
      this.lastError = String(e);
      console.error("[hub] start failed:", e);
      setTimeout(() => this.start(), 30000);
    }
  }

  /** Simulator entry points (dev only) — reuse the exact live paths. */
  onSimProb(fixtureId: number, point: ProbPoint) {
    const match = this.matches.get(fixtureId);
    if (!match) return;
    match.probs.push(point);
    if (match.probs.length > MAX_PROB_POINTS) match.probs.shift();
    match.lastUpdate = Date.now();
    this.broadcast({ type: "prob", fixtureId, point });
    this.detectShift(match);
  }

  onSimScore(fixtureId: number, home: number, away: number, gameState: string, minute?: number) {
    const match = this.matches.get(fixtureId);
    if (!match) return;
    const scored = home !== match.scoreHome || away !== match.scoreAway;
    const side = home !== match.scoreHome ? "home" : "away";
    match.scoreHome = home;
    match.scoreAway = away;
    match.gameState = gameState;
    match.minute = minute;
    if (scored) {
      const team = side === "home" ? match.home : match.away;
      const event = makeEvent({
        fixtureId,
        ts: Date.now(),
        kind: "goal",
        side,
        minute,
        label: `GOAL! ${team} score, ${home}–${away}`,
      });
      match.events.push(event);
      this.broadcast({ type: "event", event });
    }
    this.broadcast({ type: "score", fixtureId, scoreHome: home, scoreAway: away, gameState, minute });
  }

  emitEvent(event: ReturnType<typeof makeEvent>) {
    const match = this.matches.get(event.fixtureId);
    if (!match) return;
    match.events.push(event);
    this.broadcast({ type: "event", event });
  }

  /** Pre-build replay files for finished fixtures so replays start instantly. */
  private async warmReplays() {
    const { ensureMaterialized } = await import("./replay");
    for (const m of this.snapshot()) {
      const finished = isEndedStatus(m.statusId) || m.startTime < Date.now() - 3 * 3600000;
      if (!finished) continue;
      try {
        await ensureMaterialized(m.fixtureId, m.startTime);
      } catch (e) {
        console.error(`[hub] warm replay ${m.fixtureId} failed:`, String(e).slice(0, 120));
      }
    }
    console.log("[hub] replay warm-up complete");
  }

  private async loadFixtures() {
    const today = Math.floor(Date.now() / 86400000);
    // Window starts two weeks back so recently finished matches (replayable)
    // are present alongside upcoming ones.
    const fixtures = await txGet<TxFixture[]>(
      `/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}&startEpochDay=${today - 14}`
    );
    for (const f of fixtures) {
      if (!this.matches.has(f.FixtureId)) {
        this.matches.set(f.FixtureId, fixtureToMatch(f));
      }
    }
  }

  private async openStream(kind: "odds" | "scores") {
    const { apiToken } = await getAuth();
    const url = `${API_BASE}/${kind}/stream`;

    const es = new EventSource(url, {
      fetch: async (input, init) => {
        const attempt = (token: string) =>
          fetch(input, {
            ...init,
            headers: {
              ...(init?.headers as Record<string, string>),
              "Accept-Encoding": "deflate",
              Authorization: `Bearer ${token}`,
              "X-Api-Token": apiToken,
            },
          });
        const { jwt } = await getAuth();
        let res = await attempt(jwt);
        if (res.status === 401 || res.status === 403) {
          console.log(`[hub] ${kind} stream rejected (${res.status}); renewing JWT`);
          res = await attempt(await renewJwt());
        }
        return res;
      },
    });

    es.onopen = () => console.log(`[hub] ${kind} stream open`);
    es.onerror = (err) => {
      this.lastError = `${kind} stream error: ${JSON.stringify(err)}`;
      console.error(`[hub] ${kind} stream error`, err);
    };
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        this.record(kind, data);
        if (kind === "odds") this.onOdds(data as TxOddsPayload);
        else this.onScores(data as TxScores);
      } catch (e) {
        console.error(`[hub] bad ${kind} payload`, e, String(ev.data).slice(0, 300));
      }
    };
  }

  onOdds(odds: TxOddsPayload) {
    const match = this.matches.get(odds.FixtureId);
    if (!match) return;

    const marketKey = `${odds.SuperOddsType}|${odds.MarketParameters ?? ""}`;
    if (!this.seenMarkets.has(marketKey)) {
      this.seenMarkets.add(marketKey);
      console.log(`[hub] market seen: ${marketKey}`);
    }

    const point = oddsToProbPoint(odds, match.p1IsHome);
    if (!point) return;

    const prev = match.probs[match.probs.length - 1];
    if (prev && prev.ts >= point.ts) return; // stale/out-of-order
    match.probs.push(point);
    if (match.probs.length > MAX_PROB_POINTS) match.probs.shift();
    match.lastUpdate = Date.now();
    this.broadcast({ type: "prob", fixtureId: match.fixtureId, point });
    this.detectShift(match);
  }

  private detectShift(match: MatchState) {
    if (!isInPlay(match.statusId) && process.env.TXLINE_SIM !== "1") return;
    const points = match.probs;
    const now = points[points.length - 1];
    if (!now) return;
    const base = [...points].reverse().find((p) => now.ts - p.ts >= SHIFT_LOOKBACK_MS);
    if (!base) return;
    const last = this.lastShiftAt.get(match.fixtureId) || 0;
    if (now.ts - last < SHIFT_DEBOUNCE_MS) return;

    const dHome = now.home - base.home;
    const dAway = now.away - base.away;
    const side = Math.abs(dHome) >= Math.abs(dAway) ? "home" : "away";
    const delta = side === "home" ? dHome : dAway;
    if (Math.abs(delta) < SHIFT_THRESHOLD_PP) return;

    this.lastShiftAt.set(match.fixtureId, now.ts);
    const team = side === "home" ? match.home : match.away;
    const dir = delta > 0 ? "surging" : "sliding";
    const event = makeEvent({
      fixtureId: match.fixtureId,
      ts: now.ts,
      kind: "shift",
      side,
      minute: match.minute,
      label: `Market shift: ${team} ${dir}`,
      delta: Math.round(delta * 10) / 10,
    });
    match.events.push(event);
    this.broadcast({ type: "event", event });
  }

  onScores(s: TxScores) {
    const match = this.matches.get(s.FixtureId);
    if (!match) return;
    const events = applyScores(match, s);
    for (const event of events) this.broadcast({ type: "event", event });
    this.broadcast({
      type: "score",
      fixtureId: match.fixtureId,
      scoreHome: match.scoreHome,
      scoreAway: match.scoreAway,
      gameState: match.gameState,
      minute: match.minute,
    });
  }

  private record(kind: string, data: unknown) {
    try {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const dir = path.join(RECORDINGS_DIR, NETWORK);
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(
        path.join(dir, `${kind}-${day}.jsonl`),
        JSON.stringify({ t: Date.now(), data }) + "\n"
      );
    } catch {
      // recording is best-effort; never break the live path
    }
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private broadcast(msg: StreamMessage) {
    for (const fn of this.subscribers) {
      try {
        fn(msg);
      } catch {
        this.subscribers.delete(fn);
      }
    }
  }

  snapshot(): MatchState[] {
    return [...this.matches.values()].sort((a, b) => a.startTime - b.startTime);
  }
}

// Survive Next.js dev HMR by pinning the hub to globalThis
const g = globalThis as unknown as { __matchHub?: MatchHub };
export const hub: MatchHub = g.__matchHub ?? (g.__matchHub = new MatchHub());
