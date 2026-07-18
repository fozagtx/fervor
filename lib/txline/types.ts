// Shapes for TxLINE payloads, matched against real devnet feed data.

export interface TxFixture {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
}

export interface TxOddsPayload {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  /** e.g. "TXLineStablePriceDemargined" */
  Bookmaker: string;
  BookmakerId: number;
  /** e.g. "1X2_PARTICIPANT_RESULT", "ASIANHANDICAP_PARTICIPANT_GOALS" */
  SuperOddsType: string;
  GameState?: string | null;
  InRunning: boolean;
  /** e.g. null (full match), "half=1", "line=-0.5" */
  MarketParameters?: string | null;
  MarketPeriod?: string | null;
  /** e.g. ["part1","draw","part2"], ["over","under"] */
  PriceNames?: string[];
  /** decimal odds ×1000 */
  Prices?: number[];
  /** demargined percentages ("60.423") or "NA"; aligned with PriceNames */
  Pct?: string[];
}

interface TxScorePeriod {
  Goals?: number;
  Corners?: number;
  YellowCards?: number;
  RedCards?: number;
  [key: string]: number | undefined;
}

export interface TxScoreSide {
  H1?: TxScorePeriod;
  H2?: TxScorePeriod;
  HT?: TxScorePeriod;
  ET1?: TxScorePeriod;
  ET2?: TxScorePeriod;
  Total?: TxScorePeriod;
}

/** A scores feed message (CamelCase in the real feed, unlike the spec). */
export interface TxScores {
  FixtureId: number;
  /** top-level GameState is static ("scheduled"); use StatusId instead */
  GameState?: string;
  StartTime?: number;
  CompetitionId?: number;
  Participant1IsHome?: boolean;
  Participant1Id?: number;
  Participant2Id?: number;
  /** event vocabulary: goal, yellow_card, red_card, penalty, kickoff, status, … */
  Action: string;
  Id?: number;
  Ts: number;
  Seq?: number;
  /** 2=1st half, 3=half-time, 4=2nd half, 5=ended, 100=finalised */
  StatusId?: number;
  Type?: string;
  /** 1 or 2 — which participant the action belongs to */
  Participant?: number;
  Confirmed?: boolean;
  Clock?: { Running?: boolean; Seconds?: number };
  Score?: { Participant1?: TxScoreSide; Participant2?: TxScoreSide };
  Data?: Record<string, unknown>;
  Stats?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---- Normalized app-level shapes ----

export interface ProbPoint {
  ts: number;
  /** implied win probabilities, 0..100 */
  home: number;
  draw: number;
  away: number;
}

export type MatchEventKind =
  | "goal"
  | "goal_disallowed"
  | "card_red"
  | "card_yellow"
  | "penalty"
  | "var"
  | "kickoff"
  | "halftime"
  | "fulltime"
  | "shift" // significant odds movement
  | "info";

export interface MatchEvent {
  id: string;
  fixtureId: number;
  ts: number;
  kind: MatchEventKind;
  side?: "home" | "away";
  minute?: number;
  label: string;
  /** win-prob delta for the affected side at the time of the event, pp */
  delta?: number;
}

export interface MatchState {
  fixtureId: number;
  competition: string;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  /** true when Participant1 is the home side (drives part1/part2 mapping) */
  p1IsHome: boolean;
  startTime: number;
  gameState: string;
  /** raw StatusId from the feed, when known */
  statusId?: number;
  scoreHome: number;
  scoreAway: number;
  minute?: number;
  probs: ProbPoint[];
  events: MatchEvent[];
  lastUpdate: number;
}

export type StreamMessage =
  | { type: "init"; matches: MatchState[] }
  | { type: "prob"; fixtureId: number; point: ProbPoint }
  | { type: "score"; fixtureId: number; scoreHome: number; scoreAway: number; gameState: string; minute?: number }
  | { type: "event"; event: MatchEvent }
  | { type: "match"; match: MatchState }
  | { type: "replay_done" }
  | { type: "heartbeat"; ts: number };
