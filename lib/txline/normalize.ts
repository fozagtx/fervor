import type {
  MatchEvent,
  MatchState,
  ProbPoint,
  TxFixture,
  TxOddsPayload,
  TxScores,
  TxScoreSide,
} from "./types";

/**
 * The win-probability river uses the full-match consensus market:
 * SuperOddsType "1X2_PARTICIPANT_RESULT" with no MarketParameters
 * (parameters like "half=1" denote period sub-markets).
 */
export function isMatchWinnerMarket(odds: TxOddsPayload): boolean {
  if (odds.SuperOddsType !== "1X2_PARTICIPANT_RESULT") return false;
  // Period sub-markets ("half=1") appear in MarketParameters on the live
  // stream but in MarketPeriod in the interval archive - exclude both.
  if (odds.MarketParameters || odds.MarketPeriod) return false;
  return (odds.PriceNames?.length ?? 0) === 3;
}

/**
 * PriceNames for 1X2 are ["part1","draw","part2"] - participant order, not
 * home/away order. p1IsHome decides which side part1 belongs to.
 */
export function oddsToProbPoint(
  odds: TxOddsPayload,
  p1IsHome: boolean
): ProbPoint | null {
  if (!isMatchWinnerMarket(odds) || !odds.Pct || !odds.PriceNames) return null;
  const lower = odds.PriceNames.map((n) => n.trim().toLowerCase());
  const i1 = lower.findIndex((n) => n === "part1" || n === "1" || n === "home");
  const ix = lower.findIndex((n) => n === "draw" || n === "x");
  const i2 = lower.findIndex((n) => n === "part2" || n === "2" || n === "away");
  if (i1 < 0 || ix < 0 || i2 < 0) return null;

  const p1 = parseFloat(odds.Pct[i1]);
  const dr = parseFloat(odds.Pct[ix]);
  const p2 = parseFloat(odds.Pct[i2]);
  if (![p1, dr, p2].every((v) => isFinite(v) && v > 0 && v < 100)) return null;

  return {
    ts: odds.Ts,
    home: round1(p1IsHome ? p1 : p2),
    draw: round1(dr),
    away: round1(p1IsHome ? p2 : p1),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---- Scores ----

/** StatusId → human game state. */
export function statusLabel(statusId: number | undefined): string | null {
  switch (statusId) {
    case 1:
      return "Scheduled";
    case 2:
      return "1st Half";
    case 3:
      return "Half-time";
    case 4:
      return "2nd Half";
    case 5:
      return "Full Time";
    case 6:
      return "Extra Time";
    case 7:
      return "Extra Time";
    case 8:
      return "Extra Time";
    case 9:
      return "Penalty Shoot-out";
    case 100:
      return "Full Time";
    default:
      return statusId !== undefined ? `In Play` : null;
  }
}

export function isEndedStatus(statusId: number | undefined): boolean {
  return statusId === 5 || statusId === 100;
}

/** Play is running (not scheduled, not half-time, not ended). */
export function isInPlay(statusId: number | undefined): boolean {
  return statusId === 2 || statusId === 4 || statusId === 6 || statusId === 8 || statusId === 9;
}

const goalsOf = (side: TxScoreSide | undefined): number =>
  side?.Total?.Goals ?? 0;

export interface ScoreInfo {
  home?: number;
  away?: number;
  gameState?: string;
  statusId?: number;
  minute?: number;
  action: string;
  /** which UI side the action belongs to */
  side?: "home" | "away";
  confirmed?: boolean;
}

export function extractScoreInfo(s: TxScores, p1IsHome: boolean): ScoreInfo {
  const info: ScoreInfo = { action: s.Action, confirmed: s.Confirmed };

  if (s.Score) {
    const p1Goals = goalsOf(s.Score.Participant1);
    const p2Goals = goalsOf(s.Score.Participant2);
    info.home = p1IsHome ? p1Goals : p2Goals;
    info.away = p1IsHome ? p2Goals : p1Goals;
  }
  if (s.StatusId !== undefined) {
    info.statusId = s.StatusId;
    info.gameState = statusLabel(s.StatusId) ?? undefined;
  }
  if (s.Clock?.Seconds !== undefined) {
    info.minute = Math.floor(s.Clock.Seconds / 60);
  }
  if (s.Participant === 1 || s.Participant === 2) {
    const isP1 = s.Participant === 1;
    info.side = isP1 === p1IsHome ? "home" : "away";
  }
  return info;
}

// ---- Match assembly ----

export function fixtureToMatch(f: TxFixture): MatchState {
  const p1IsHome = f.Participant1IsHome !== false;
  return {
    fixtureId: f.FixtureId,
    competition: f.Competition,
    home: p1IsHome ? f.Participant1 : f.Participant2,
    away: p1IsHome ? f.Participant2 : f.Participant1,
    homeId: p1IsHome ? f.Participant1Id : f.Participant2Id,
    awayId: p1IsHome ? f.Participant2Id : f.Participant1Id,
    p1IsHome,
    startTime: f.StartTime,
    gameState: "Scheduled",
    scoreHome: 0,
    scoreAway: 0,
    probs: [],
    events: [],
    lastUpdate: f.Ts,
  };
}

let eventCounter = 0;
export function makeEvent(partial: Omit<MatchEvent, "id">): MatchEvent {
  eventCounter += 1;
  return { id: `${partial.fixtureId}-${partial.ts}-${eventCounter}`, ...partial };
}

/**
 * Applies one scores message to a MatchState, returning the events it
 * produced. Shared by the live hub and the replay engine so both paths
 * behave identically.
 */
export function applyScores(match: MatchState, s: TxScores): MatchEvent[] {
  const info = extractScoreInfo(s, match.p1IsHome);
  const events: MatchEvent[] = [];
  const prevHome = match.scoreHome;
  const prevAway = match.scoreAway;
  const prevStatus = match.statusId;

  if (info.minute !== undefined) match.minute = info.minute;
  if (info.statusId !== undefined) {
    match.statusId = info.statusId;
    if (info.gameState) match.gameState = info.gameState;
  }
  if (info.home !== undefined) match.scoreHome = info.home;
  if (info.away !== undefined) match.scoreAway = info.away;
  match.lastUpdate = Date.now();

  // Goals: detect via score movement so unconfirmed/confirmed duplicates dedupe
  if (match.scoreHome > prevHome || match.scoreAway > prevAway) {
    const side = match.scoreHome > prevHome ? "home" : "away";
    const team = side === "home" ? match.home : match.away;
    events.push(
      makeEvent({
        fixtureId: match.fixtureId,
        ts: s.Ts || Date.now(),
        kind: "goal",
        side,
        minute: match.minute,
        label: `GOAL! ${team} score, ${match.scoreHome}–${match.scoreAway}`,
      })
    );
  } else if (match.scoreHome < prevHome || match.scoreAway < prevAway) {
    const side = match.scoreHome < prevHome ? "home" : "away";
    const team = side === "home" ? match.home : match.away;
    events.push(
      makeEvent({
        fixtureId: match.fixtureId,
        ts: s.Ts || Date.now(),
        kind: "goal_disallowed",
        side,
        minute: match.minute,
        label: `Goal disallowed: ${team}, back to ${match.scoreHome}–${match.scoreAway}`,
      })
    );
  }

  // Cards / penalties / VAR (only once, on the confirmed message)
  if (info.confirmed !== false) {
    const team = info.side === "away" ? match.away : match.home;
    if (s.Action === "red_card") {
      events.push(
        makeEvent({
          fixtureId: match.fixtureId,
          ts: s.Ts,
          kind: "card_red",
          side: info.side,
          minute: match.minute,
          label: `Red card! ${team} down to ten`,
        })
      );
    } else if (s.Action === "penalty") {
      events.push(
        makeEvent({
          fixtureId: match.fixtureId,
          ts: s.Ts,
          kind: "penalty",
          side: info.side,
          minute: match.minute,
          label: `Penalty to ${team}!`,
        })
      );
    } else if (s.Action === "var") {
      events.push(
        makeEvent({
          fixtureId: match.fixtureId,
          ts: s.Ts,
          kind: "var",
          minute: match.minute,
          label: "VAR check in progress",
        })
      );
    }
  }

  // Game-state transitions from StatusId changes
  if (info.statusId !== undefined && info.statusId !== prevStatus) {
    if (info.statusId === 2 && (prevStatus === undefined || prevStatus === 1)) {
      events.push(
        makeEvent({ fixtureId: match.fixtureId, ts: s.Ts, kind: "kickoff", minute: 0, label: "Kick-off" })
      );
    } else if (info.statusId === 3) {
      events.push(
        makeEvent({
          fixtureId: match.fixtureId,
          ts: s.Ts,
          kind: "halftime",
          minute: 45,
          label: `Half-time, ${match.scoreHome}–${match.scoreAway}`,
        })
      );
    } else if (info.statusId === 4 && prevStatus === 3) {
      events.push(
        makeEvent({ fixtureId: match.fixtureId, ts: s.Ts, kind: "kickoff", minute: 45, label: "Second half under way" })
      );
    } else if (isEndedStatus(info.statusId) && !isEndedStatus(prevStatus)) {
      events.push(
        makeEvent({
          fixtureId: match.fixtureId,
          ts: s.Ts,
          kind: "fulltime",
          minute: match.minute,
          label: `Full-time, ${match.scoreHome}–${match.scoreAway}`,
        })
      );
    }
  }

  match.events.push(...events);
  return events;
}
