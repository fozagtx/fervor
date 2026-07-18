// Shapes mirrored from the TxLINE OpenAPI spec (v1.5.6)

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
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  GameState?: string;
  InRunning: boolean;
  MarketParameters?: string;
  MarketPeriod?: string;
  PriceNames?: string[];
  Prices?: number[];
  /** Demargined percentages ("52.632") or "NA"; aligned with PriceNames */
  Pct?: string[];
}

export interface TxScores {
  fixtureId: number;
  gameState: string;
  startTime: number;
  isTeam: boolean;
  fixtureGroupId: number;
  competitionId: number;
  countryId: number;
  sportId: number;
  participant1IsHome: boolean;
  participant1Id: number;
  participant2Id: number;
  action: string;
  id: number;
  ts: number;
  connectionId: number;
  seq: number;
  statusSoccerId?: string;
  type?: string;
  confirmed?: boolean;
  scoreSoccer?: Record<string, unknown>;
  dataSoccer?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  possession?: number;
  inPlayInfo?: Record<string, unknown>;
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
  | "card_red"
  | "card_yellow"
  | "corner"
  | "penalty"
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
  startTime: number;
  gameState: string;
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
