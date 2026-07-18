import fs from "fs";
import path from "path";
import { API_BASE, NETWORK, RECORDINGS_DIR } from "./config";
import { getAuth, renewJwt } from "./auth";
import { applyScores, isInPlay, isMatchWinnerMarket, makeEvent, oddsToProbPoint } from "./normalize";
import { hub } from "./hub";
import type {
  MatchState,
  StreamMessage,
  TxOddsPayload,
  TxScores,
} from "./types";

interface TimelineItem {
  ts: number;
  kind: "odds" | "scores";
  data: TxOddsPayload | TxScores;
}

const replaysDir = () => path.join(RECORDINGS_DIR, NETWORK, "replays");
const replayFile = (fixtureId: number) => path.join(replaysDir(), `${fixtureId}.jsonl`);

// ---- Timeline sources ----

/** Materialized replay file (fastest, curated). */
function loadMaterialized(fixtureId: number): TimelineItem[] {
  try {
    const lines = fs.readFileSync(replayFile(fixtureId), "utf8").split("\n");
    const items: TimelineItem[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        items.push(JSON.parse(line) as TimelineItem);
      } catch {
        // skip malformed line
      }
    }
    return items;
  } catch {
    return [];
  }
}

function materialize(fixtureId: number, items: TimelineItem[]) {
  try {
    fs.mkdirSync(replaysDir(), { recursive: true });
    fs.writeFileSync(
      replayFile(fixtureId),
      items.map((i) => JSON.stringify(i)).join("\n") + "\n"
    );
  } catch (e) {
    console.error("[replay] materialize failed:", e);
  }
}

/** Live-recording JSONL files written by the hub. */
function loadRecordings(fixtureId: number): TimelineItem[] {
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
    let text = "";
    try {
      text = fs.readFileSync(path.join(dir, file), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as { t: number; data: TxOddsPayload & TxScores };
        if (rec.data.FixtureId !== fixtureId) continue;
        if (kind === "odds" && !isMatchWinnerMarket(rec.data as TxOddsPayload)) continue;
        items.push({ ts: rec.data.Ts || rec.t, kind, data: rec.data });
      } catch {
        // skip malformed line
      }
    }
  }
  items.sort((a, b) => a.ts - b.ts);
  return items;
}

async function rawGet(pathAndQuery: string): Promise<string> {
  const { jwt, apiToken } = await getAuth();
  const doFetch = (t: string) =>
    fetch(`${API_BASE}${pathAndQuery}`, {
      headers: { Authorization: `Bearer ${t}`, "X-Api-Token": apiToken },
    });
  let res = await doFetch(jwt);
  if (res.status === 401) res = await doFetch(await renewJwt());
  if (!res.ok) throw new Error(`GET ${pathAndQuery} → ${res.status}`);
  return res.text();
}

/** Some endpoints return JSON arrays, others SSE-framed `data:` lines. */
function parseSseOrJson<T>(text: string): T[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as T[];
    } catch {
      return [];
    }
  }
  const out: T[] = [];
  for (const line of trimmed.split("\n")) {
    const m = line.match(/^data:\s*(\{.*\})\s*$/);
    if (m) {
      try {
        out.push(JSON.parse(m[1]) as T);
      } catch {
        // skip malformed line
      }
    }
  }
  return out;
}

/**
 * Backfills a full match timeline from the TxLINE historical APIs:
 * scores via /scores/historical, odds by paging the 5-minute interval
 * archive across the match window. Materialized to disk on success.
 */
async function backfillTimeline(fixtureId: number, startTime: number): Promise<TimelineItem[]> {
  console.log(`[replay] backfilling fixture ${fixtureId}…`);
  const items: TimelineItem[] = [];

  const scores = parseSseOrJson<TxScores>(await rawGet(`/scores/historical/${fixtureId}`));
  for (const s of scores) {
    if (s.FixtureId !== fixtureId) continue;
    items.push({ ts: s.Ts, kind: "scores", data: s });
  }

  // Odds archive: page 5-minute intervals from 15 min before kick-off to
  // 2h40m after (covers extra time and shoot-outs).
  const from = startTime - 15 * 60000;
  const to = startTime + 160 * 60000;
  const fetches: Promise<void>[] = [];
  for (let t = from; t <= to; t += 5 * 60000) {
    const epochDay = Math.floor(t / 86400000);
    const hourOfDay = Math.floor((t % 86400000) / 3600000);
    const interval = Math.floor((t % 3600000) / (5 * 60000));
    fetches.push(
      rawGet(`/odds/updates/${epochDay}/${hourOfDay}/${interval}`)
        .then((text) => {
          for (const o of parseSseOrJson<TxOddsPayload>(text)) {
            if (o.FixtureId !== fixtureId || !isMatchWinnerMarket(o)) continue;
            items.push({ ts: o.Ts, kind: "odds", data: o });
          }
        })
        .catch(() => {
          // missing interval pages are fine
        })
    );
  }
  await Promise.all(fetches);

  items.sort((a, b) => a.ts - b.ts);
  const oddsCount = items.filter((i) => i.kind === "odds").length;
  console.log(`[replay] backfill done: ${items.length} items (${oddsCount} odds)`);
  if (items.length > 20) materialize(fixtureId, items);
  return items;
}

async function loadTimeline(fixtureId: number, startTime: number): Promise<TimelineItem[]> {
  let timeline = loadMaterialized(fixtureId);
  if (timeline.length > 20) return trimToMatch(timeline);
  timeline = loadRecordings(fixtureId);
  if (timeline.length > 20) return trimToMatch(timeline);
  try {
    return trimToMatch(await backfillTimeline(fixtureId, startTime));
  } catch (e) {
    console.error("[replay] backfill failed:", e);
    return timeline;
  }
}

/**
 * Feed history can begin days before kick-off (coverage notes, lineups,
 * pre-match odds). Start the replay ten minutes before the first kick-off.
 */
function trimToMatch(timeline: TimelineItem[]): TimelineItem[] {
  const kickoff = timeline.find(
    (i) =>
      i.kind === "scores" &&
      ((i.data as TxScores).Action === "kickoff" || (i.data as TxScores).StatusId === 2)
  );
  if (!kickoff) return timeline;
  const from = kickoff.ts - 10 * 60000;
  return timeline.filter((i) => i.ts >= from);
}

/** Pre-build the replay file for a finished fixture (idempotent). */
export async function ensureMaterialized(fixtureId: number, startTime: number): Promise<void> {
  if (loadMaterialized(fixtureId).length > 20) return;
  if (loadRecordings(fixtureId).length > 20) return;
  await backfillTimeline(fixtureId, startTime);
}

/**
 * Derive the final score and state of a fixture from its stored timeline by
 * running every scores message through the normal pipeline on a scratch copy.
 */
export function finalStateFor(
  match: MatchState
): { scoreHome: number; scoreAway: number; gameState: string; statusId?: number; minute?: number } | null {
  let timeline = loadMaterialized(match.fixtureId);
  if (timeline.length < 10) timeline = loadRecordings(match.fixtureId);
  if (timeline.length < 10) return null;
  const scratch: MatchState = { ...match, scoreHome: 0, scoreAway: 0, probs: [], events: [] };
  for (const item of timeline) {
    if (item.kind === "scores") applyScores(scratch, item.data as TxScores);
  }
  if (scratch.statusId === undefined) return null;
  return {
    scoreHome: scratch.scoreHome,
    scoreAway: scratch.scoreAway,
    gameState: scratch.gameState,
    statusId: scratch.statusId,
    minute: scratch.minute,
  };
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
        statusId: undefined,
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
        p1IsHome: true,
        startTime: Date.now(),
        gameState: "Replay",
        scoreHome: 0,
        scoreAway: 0,
        probs: [],
        events: [],
        lastUpdate: Date.now(),
      };

  send({ type: "init", matches: [match] });

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastShiftTs = 0;

  const detectReplayShift = () => {
    if (!isInPlay(match.statusId)) return;
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
      label: `Market shift: ${team} ${delta > 0 ? "surging" : "sliding"}`,
      delta: Math.round(delta * 10) / 10,
    });
    match.events.push(event);
    send({ type: "event", event });
  };

  const apply = (item: TimelineItem) => {
    if (item.kind === "odds") {
      const point = oddsToProbPoint(item.data as TxOddsPayload, match.p1IsHome);
      if (!point) return;
      const prev = match.probs[match.probs.length - 1];
      if (prev && prev.ts >= point.ts) return;
      match.probs.push(point);
      send({ type: "prob", fixtureId, point });
      detectReplayShift();
    } else {
      const events = applyScores(match, item.data as TxScores);
      for (const event of events) send({ type: "event", event });
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

  (async () => {
    const timeline = await loadTimeline(fixtureId, match.startTime);
    if (cancelled) return;
    if (timeline.length === 0) {
      send({ type: "replay_done" });
      return;
    }
    let idx = 0;
    const step = () => {
      if (cancelled) return;
      const emitted = timeline[idx];
      apply(emitted);
      idx += 1;
      if (idx >= timeline.length) {
        send({ type: "replay_done" });
        return;
      }
      const gap = (timeline[idx].ts - emitted.ts) / speed;
      timer = setTimeout(step, Math.max(2, Math.min(gap, 5000)));
    };
    step();
  })().catch((e) => {
    console.error("[replay] session failed:", e);
    send({ type: "replay_done" });
  });

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
