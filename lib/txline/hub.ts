import fs from "fs";
import path from "path";
import { EventSource } from "eventsource";
import { API_BASE, NETWORK, RECORDINGS_DIR, WORLD_CUP_COMPETITION_ID } from "./config";
import { getAuth, renewJwt } from "./auth";
import { txGet } from "./api";
import { applyScores, fixtureToMatch, isEndedStatus, isInPlay, makeEvent, oddsToProbPoint } from "./normalize";
import resultsSeed from "./results-seed.json";
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
    try {
      await this.loadFixtures();
      this.rehydrate();
      await this.openStream("odds");
      await this.openStream("scores");
      setInterval(() => this.broadcast({ type: "heartbeat", ts: Date.now() }), 25000);
      setInterval(() => this.loadFixtures().catch(() => {}), 10 * 60 * 1000);
      setInterval(() => this.watchdog(), 60 * 1000);
      console.log(`[hub] started on ${NETWORK}: ${this.matches.size} fixtures`);
      void this.warmReplays();
    } catch (e) {
      this.started = false;
      this.lastError = String(e);
      console.error("[hub] start failed:", e);
      setTimeout(() => this.start(), 30000);
    }
  }

  /**
   * Pre-build replay files for finished fixtures so replays start instantly,
   * and lift each one's final score into the lobby state.
   */
  private async warmReplays() {
    const { ensureMaterialized, finalStateFor } = await import("./replay");
    for (const m of this.snapshot()) {
      const finished = isEndedStatus(m.statusId) || m.startTime < Date.now() - 3 * 3600000;
      if (!finished) continue;
      try {
        await ensureMaterialized(m.fixtureId, m.startTime);
        const finalState = finalStateFor(m);
        if (finalState) {
          Object.assign(m, finalState);
          this.broadcast({
            type: "score",
            fixtureId: m.fixtureId,
            scoreHome: m.scoreHome,
            scoreAway: m.scoreAway,
            gameState: m.gameState,
            minute: m.minute,
          });
        }
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
    this.applyResultsSeed();
  }

  /**
   * Known final results ship inside the bundle so a cold boot (fresh disk)
   * shows correct scores immediately, before the replay warm-up refreshes.
   */
  private applyResultsSeed() {
    for (const [fixtureId, result] of Object.entries(
      resultsSeed as Record<
        string,
        { scoreHome: number; scoreAway: number; gameState: string; statusId?: number; minute?: number }
      >
    )) {
      const match = this.matches.get(Number(fixtureId));
      if (!match || match.statusId !== undefined) continue;
      Object.assign(match, result);
    }
  }

  private streams = new Map<string, { es: EventSource; lastMessageAt: number }>();

  private async openStream(kind: "odds" | "scores") {
    const { apiToken } = await getAuth();
    const url = `${API_BASE}/${kind}/stream`;

    const existing = this.streams.get(kind);
    if (existing) {
      try {
        existing.es.close();
      } catch {
        // already closed
      }
    }

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

    const entry = { es, lastMessageAt: Date.now() };
    this.streams.set(kind, entry);

    es.onopen = () => console.log(`[hub] ${kind} stream open`);
    es.onerror = (err) => {
      this.lastError = `${kind} stream error: ${JSON.stringify(err)}`;
      console.error(`[hub] ${kind} stream error`, err);
    };
    es.onmessage = (ev) => {
      entry.lastMessageAt = Date.now();
      this.lastError = null; // stream is healthy again
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

  /**
   * The upstream feed can drop a connection without an error event. If a
   * stream has been silent for too long, tear it down and reconnect.
   */
  private watchdog() {
    const SILENT_LIMIT = 4 * 60 * 1000;
    for (const [kind, entry] of this.streams) {
      if (Date.now() - entry.lastMessageAt > SILENT_LIMIT) {
        console.log(`[hub] ${kind} stream silent for 4m; reconnecting`);
        this.openStream(kind as "odds" | "scores").catch((e) =>
          console.error(`[hub] ${kind} reconnect failed:`, e)
        );
        entry.lastMessageAt = Date.now(); // avoid thrashing while reconnecting
      }
    }
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
    if (!isInPlay(match.statusId)) return;
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

  private rehydrating = false;

  /**
   * Replay today's and yesterday's recorded feed from disk through the normal
   * pipeline so a restart does not lose the probability rivers and events.
   */
  private rehydrate() {
    this.rehydrating = true;
    try {
      let count = 0;
      const replayFile = (file: string) => {
        let text = "";
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          return;
        }
        const kind = path.basename(file).startsWith("odds") ? "odds" : "scores";
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const rec = JSON.parse(line) as { data: TxOddsPayload & TxScores };
            if (kind === "odds") this.onOdds(rec.data);
            else this.onScores(rec.data);
            count++;
          } catch {
            // skip malformed line
          }
        }
      };

      // Bundled seed history first (survives fresh disks), then the volume
      try {
        for (const f of fs.readdirSync("seed-recordings")) {
          if (f.endsWith(".jsonl")) replayFile(path.join("seed-recordings", f));
        }
      } catch {
        // no seed dir
      }
      const dir = path.join(RECORDINGS_DIR, NETWORK);
      const days = [Date.now() - 86400000, Date.now()].map((t) =>
        new Date(t).toISOString().slice(0, 10).replace(/-/g, "")
      );
      for (const day of days) {
        for (const kind of ["odds", "scores"] as const) {
          replayFile(path.join(dir, `${kind}-${day}.jsonl`));
        }
      }
      if (count) console.log(`[hub] rehydrated ${count} recorded messages`);
    } finally {
      this.rehydrating = false;
    }
  }

  private record(kind: string, data: unknown) {
    if (this.rehydrating) return;
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
