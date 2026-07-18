import fs from "fs";
import path from "path";
import { NETWORK, RECORDINGS_DIR } from "./config";
import { extractScoreInfo, makeEvent, oddsToProbPoint } from "./normalize";
import { hub } from "./hub";
import type {
  MatchState,
  StreamMessage,
  TxOddsPayload,
  TxScores,
} from "./types";

interface RecordedLine {
  t: number;
  data: TxOddsPayload | TxScores;
}

interface TimelineItem {
  ts: number;
  kind: "odds" | "scores";
  data: TxOddsPayload | TxScores;
}

/**
 * Loads every recorded odds/scores line for a fixture across all recording
 * files, ordered by original feed timestamp.
 */
function loadTimeline(fixtureId: number): TimelineItem[] {
  const dir = path.join(RECORDINGS_DIR, NETWORK);
  const items: TimelineItem[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return items;
  }
  for (const file of files) {
    const kind = file.startsWith("odds-") ? "odds" : file.startsWith("scores-") ? "scores" : null;
    if (!kind) continue;
    const lines = fs.readFileSync(path.join(dir, file), "utf8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as RecordedLine;
        const fid =
          kind === "odds"
            ? (rec.data as TxOddsPayload).FixtureId
            : (rec.data as TxScores).fixtureId;
        if (fid !== fixtureId) continue;
        const ts =
          (kind === "odds"
            ? (rec.data as TxOddsPayload).Ts
            : (rec.data as TxScores).ts) || rec.t;
        items.push({ ts, kind, data: rec.data });
      } catch {
        // skip malformed lines
      }
    }
  }
  items.sort((a, b) => a.ts - b.ts);
  return items;
}

/** Dev fallback: synthesize a timeline when no recording exists (sim mode). */
function synthesizeTimeline(base: MatchState): TimelineItem[] {
  const items: TimelineItem[] = [];
  const start = Date.now() - 105 * 60000;
  let h = 38;
  let a = 34;
  const goalMinutes = [23, 57, 78];
  let scoreH = 0;
  let scoreA = 0;
  for (let min = 0; min <= 95; min += 0.5) {
    const ts = start + min * 60000;
    if (goalMinutes.includes(min)) {
      const side = Math.random() < 0.55 ? "h" : "a";
      if (side === "h") {
        scoreH += 1;
        h = Math.min(90, h + 14);
      } else {
        scoreA += 1;
        a = Math.min(90, a + 14);
      }
      items.push({
        ts,
        kind: "scores",
        data: {
          fixtureId: base.fixtureId,
          gameState: min < 45 ? "1st Half" : "2nd Half",
          ts,
          scoreSoccer: { parti1: scoreH, parti2: scoreA },
          inPlayInfo: { minute: min },
          action: "goal",
        } as unknown as TxScores,
      });
    }
    h += (Math.random() - 0.5) * 2;
    a += (Math.random() - 0.5) * 2;
    h = Math.max(5, Math.min(88, h));
    a = Math.max(5, Math.min(88, a));
    const d = Math.max(4, 100 - h - a);
    const total = h + a + d;
    items.push({
      ts,
      kind: "odds",
      data: {
        FixtureId: base.fixtureId,
        MessageId: `sim-${min}`,
        Ts: ts,
        Bookmaker: "Stable Price",
        BookmakerId: 0,
        SuperOddsType: "MO",
        InRunning: true,
        PriceNames: ["1", "X", "2"],
        Pct: [
          ((h / total) * 100).toFixed(3),
          ((d / total) * 100).toFixed(3),
          ((a / total) * 100).toFixed(3),
        ],
      } as TxOddsPayload,
    });
  }
  items.push({
    ts: start + 96 * 60000,
    kind: "scores",
    data: {
      fixtureId: base.fixtureId,
      gameState: "Full Time",
      ts: start + 96 * 60000,
      scoreSoccer: { parti1: scoreH, parti2: scoreA },
      inPlayInfo: { minute: 90 },
      action: "fulltime",
    } as unknown as TxScores,
  });
  return items;
}

/**
 * Per-connection replay session. Re-runs a recorded match through the same
 * normalization pipeline as live data, compressed by `speed`.
 * Returns a cancel function.
 */
export function startReplay(
  fixtureId: number,
  speed: number,
  send: (msg: StreamMessage) => void
): () => void {
  const source = hub.matches.get(fixtureId);
  const match: MatchState = source
    ? {
        ...source,
        gameState: "Replay",
        scoreHome: 0,
        scoreAway: 0,
        minute: 0,
        probs: [],
        events: [],
      }
    : {
        fixtureId,
        competition: "FIFA World Cup",
        home: "Home",
        away: "Away",
        homeId: 0,
        awayId: 0,
        startTime: Date.now(),
        gameState: "Replay",
        scoreHome: 0,
        scoreAway: 0,
        probs: [],
        events: [],
        lastUpdate: Date.now(),
      };

  let timeline = loadTimeline(fixtureId);
  if (timeline.length < 10 && process.env.TXLINE_SIM === "1") {
    timeline = synthesizeTimeline(match);
  }

  send({ type: "init", matches: [match] });

  if (timeline.length === 0) {
    send({ type: "replay_done" });
    return () => {};
  }

  const t0 = timeline[0].ts;
  let idx = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const step = () => {
    if (cancelled) return;
    // Emit every item due at this compressed timestamp
    const emitted = timeline[idx];
    apply(emitted);
    idx += 1;
    if (idx >= timeline.length) {
      send({ type: "replay_done" });
      return;
    }
    const gap = (timeline[idx].ts - emitted.ts) / speed;
    timer = setTimeout(step, Math.max(5, Math.min(gap, 5000)));
  };

  const apply = (item: TimelineItem) => {
    if (item.kind === "odds") {
      const point = oddsToProbPoint(item.data as TxOddsPayload, match.home, match.away);
      if (!point) return;
      const prev = match.probs[match.probs.length - 1];
      if (prev && prev.ts >= point.ts) return;
      match.probs.push(point);
      send({ type: "prob", fixtureId, point });
      detectReplayShift();
    } else {
      const s = item.data as TxScores;
      const info = extractScoreInfo(s);
      const prevHome = match.scoreHome;
      const prevAway = match.scoreAway;
      const prevState = match.gameState;
      if (info.gameState) match.gameState = info.gameState;
      if (info.minute !== undefined) match.minute = info.minute;
      if (info.home !== undefined) match.scoreHome = info.home;
      if (info.away !== undefined) match.scoreAway = info.away;

      if (match.scoreHome !== prevHome || match.scoreAway !== prevAway) {
        const side = match.scoreHome !== prevHome ? "home" : "away";
        const team = side === "home" ? match.home : match.away;
        const event = makeEvent({
          fixtureId,
          ts: s.ts || Date.now(),
          kind: "goal",
          side,
          minute: match.minute,
          label: `GOAL! ${team} score — ${match.scoreHome}–${match.scoreAway}`,
        });
        match.events.push(event);
        send({ type: "event", event });
      }
      if (info.gameState && info.gameState !== prevState) {
        const g = info.gameState.toLowerCase();
        let mapped: { kind: "kickoff" | "halftime" | "fulltime"; label: string } | null = null;
        if (/(ht|half.?time|interval)/.test(g)) mapped = { kind: "halftime", label: "Half-time" };
        else if (/(ft|full|final|ended|finish)/.test(g)) mapped = { kind: "fulltime", label: "Full-time" };
        else if (/(1st|first|kick)/.test(g) && /replay/.test(prevState.toLowerCase()))
          mapped = { kind: "kickoff", label: "Kick-off" };
        if (mapped) {
          const event = makeEvent({
            fixtureId,
            ts: s.ts || Date.now(),
            kind: mapped.kind,
            minute: match.minute,
            label: mapped.label,
          });
          match.events.push(event);
          send({ type: "event", event });
        }
      }
      send({
        type: "score",
        fixtureId,
        scoreHome: match.scoreHome,
        scoreAway: match.scoreAway,
        gameState: match.gameState,
        minute: match.minute,
      });
    }
  };

  let lastShiftTs = 0;
  const detectReplayShift = () => {
    const points = match.probs;
    const now = points[points.length - 1];
    if (!now) return;
    const base = [...points].reverse().find((p) => now.ts - p.ts >= 3 * 60000);
    if (!base || now.ts - lastShiftTs < 4 * 60000) return;
    const dHome = now.home - base.home;
    const dAway = now.away - base.away;
    const side = Math.abs(dHome) >= Math.abs(dAway) ? "home" : "away";
    const delta = side === "home" ? dHome : dAway;
    if (Math.abs(delta) < 8) return;
    lastShiftTs = now.ts;
    const team = side === "home" ? match.home : match.away;
    const event = makeEvent({
      fixtureId,
      ts: now.ts,
      kind: "shift",
      side,
      minute: match.minute,
      label: `Market shift: ${team} ${delta > 0 ? "surging" : "sliding"} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp`,
      delta: Math.round(delta * 10) / 10,
    });
    match.events.push(event);
    send({ type: "event", event });
  };

  // small delay so the client processes init first
  timer = setTimeout(step, 150);
  void t0;

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
