import type {
  MatchEvent,
  MatchState,
  ProbPoint,
  TxFixture,
  TxOddsPayload,
  TxScores,
} from "./types";

/**
 * Match-winner odds arrive with three price names. Depending on feed config
 * these are "1"/"X"/"2", "Home"/"Draw"/"Away", or the team names themselves.
 * Returns [homeIdx, drawIdx, awayIdx] into PriceNames/Pct, or null when the
 * payload is not a 3-way match-winner market.
 */
export function matchWinnerIndices(
  odds: TxOddsPayload,
  home: string,
  away: string
): [number, number, number] | null {
  const names = odds.PriceNames;
  if (!names || names.length !== 3) return null;
  const lower = names.map((n) => n.trim().toLowerCase());

  const find = (...cands: string[]) =>
    lower.findIndex((n) => cands.some((c) => n === c.toLowerCase()));

  let h = find("1", "home", home);
  let d = find("x", "draw");
  let a = find("2", "away", away);

  // Fall back to fuzzy team-name match (feeds sometimes abbreviate)
  if (h < 0)
    h = lower.findIndex((n) => home && n.includes(home.toLowerCase().slice(0, 6)));
  if (a < 0)
    a = lower.findIndex((n) => away && n.includes(away.toLowerCase().slice(0, 6)));
  if (h < 0 || d < 0 || a < 0) return null;
  return [h, d, a];
}

/** Full-match markets only; period naming varies so exclude known partials. */
export function isFullTimeMarket(odds: TxOddsPayload): boolean {
  const p = (odds.MarketPeriod || "").toLowerCase();
  if (!p) return true;
  return !/(1st|2nd|first|second|half|ht|q\d|p\d)/.test(p);
}

export function oddsToProbPoint(
  odds: TxOddsPayload,
  home: string,
  away: string
): ProbPoint | null {
  if (!odds.Pct || !odds.PriceNames) return null;
  if (!isFullTimeMarket(odds)) return null;
  const idx = matchWinnerIndices(odds, home, away);
  if (!idx) return null;
  const vals = idx.map((i) => parseFloat(odds.Pct![i]));
  if (vals.some((v) => !isFinite(v) || v <= 0 || v >= 100)) return null;
  const [h, d, a] = vals;
  return { ts: odds.Ts, home: round1(h), draw: round1(d), away: round1(a) };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---- Scores extraction (defensive: exact soccer sub-shapes vary by feed) ----

function dig(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function firstNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v !== "" && isFinite(Number(v)))
      return Number(v);
  }
  return undefined;
}

export interface ScoreInfo {
  home?: number;
  away?: number;
  gameState?: string;
  minute?: number;
  action?: string;
}

export function extractScoreInfo(s: TxScores): ScoreInfo {
  const sc = s.scoreSoccer as Record<string, unknown> | undefined;
  const home = firstNumber(
    dig(sc, "parti1"),
    dig(sc, "participant1"),
    dig(sc, "home"),
    dig(sc, "p1"),
    dig(sc, "current", "parti1"),
    dig(sc, "current", "home")
  );
  const away = firstNumber(
    dig(sc, "parti2"),
    dig(sc, "participant2"),
    dig(sc, "away"),
    dig(sc, "p2"),
    dig(sc, "current", "parti2"),
    dig(sc, "current", "away")
  );
  const minute = firstNumber(
    dig(s, "inPlayInfo", "minute"),
    dig(s, "inPlayInfo", "minutes"),
    dig(s, "inPlayInfo", "clock", "minute"),
    dig(s.dataSoccer, "Minutes"),
    dig(s.dataSoccer, "minute")
  );
  return {
    home,
    away,
    gameState: s.gameState || (s.statusSoccerId as string | undefined),
    minute,
    action: s.action,
  };
}

// ---- Match assembly ----

export function fixtureToMatch(f: TxFixture): MatchState {
  const homeFirst = f.Participant1IsHome !== false;
  return {
    fixtureId: f.FixtureId,
    competition: f.Competition,
    home: homeFirst ? f.Participant1 : f.Participant2,
    away: homeFirst ? f.Participant2 : f.Participant1,
    homeId: homeFirst ? f.Participant1Id : f.Participant2Id,
    awayId: homeFirst ? f.Participant2Id : f.Participant1Id,
    startTime: f.StartTime,
    gameState: "scheduled",
    scoreHome: 0,
    scoreAway: 0,
    probs: [],
    events: [],
    lastUpdate: f.Ts,
  };
}

let eventCounter = 0;
export function makeEvent(
  partial: Omit<MatchEvent, "id">
): MatchEvent {
  eventCounter += 1;
  return { id: `${partial.fixtureId}-${partial.ts}-${eventCounter}`, ...partial };
}
