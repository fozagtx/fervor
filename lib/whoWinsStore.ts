import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "who-wins.json");

export type Side = "home" | "draw" | "away";

export interface RecentLock {
  side: Side;
  at: number;
  /** short anon tag, e.g. a3k9 */
  tag: string;
}

export interface FixturePoll {
  home: number;
  draw: number;
  away: number;
  /** playerId → side - one vote per fan per fixture */
  voters: Record<string, Side>;
  recent: RecentLock[];
  updated: number;
}

type Store = Record<string, FixturePoll>;

function empty(): FixturePoll {
  return { home: 0, draw: 0, away: 0, voters: {}, recent: [], updated: Date.now() };
}

export function readStore(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
    // migrate older shape
    for (const k of Object.keys(raw)) {
      if (!Array.isArray(raw[k].recent)) raw[k].recent = [];
    }
    return raw;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store));
}

export function getPoll(fixtureId: number): FixturePoll {
  return readStore()[String(fixtureId)] ?? empty();
}

export function castVote(fixtureId: number, player: string, side: Side) {
  const store = readStore();
  const key = String(fixtureId);
  const poll = store[key] ?? empty();
  if (!Array.isArray(poll.recent)) poll.recent = [];
  const prev = poll.voters[player];
  if (prev === side) {
    return publicPoll(poll);
  }
  if (prev) poll[prev] = Math.max(0, poll[prev] - 1);
  poll[side] += 1;
  poll.voters[player] = side;
  poll.updated = Date.now();
  const tag = player.replace(/^fan-/, "").slice(0, 4) || "fan";
  poll.recent.unshift({ side, at: Date.now(), tag });
  if (poll.recent.length > 40) poll.recent = poll.recent.slice(0, 40);

  const ids = Object.keys(poll.voters);
  if (ids.length > 2000) {
    for (const id of ids.slice(0, ids.length - 1500)) delete poll.voters[id];
  }
  store[key] = poll;
  const keys = Object.keys(store);
  if (keys.length > 80) {
    keys
      .map((k) => ({ k, t: store[k].updated }))
      .sort((a, b) => a.t - b.t)
      .slice(0, keys.length - 60)
      .forEach(({ k }) => delete store[k]);
  }
  writeStore(store);
  return publicPoll(poll);
}

/** Public shape - no voter map. Includes FOMO fields. */
export function publicPoll(poll: FixturePoll) {
  const now = Date.now();
  const recent = (poll.recent ?? []).filter((r) => now - r.at < 30 * 60 * 1000).slice(0, 12);
  const lockingNow = recent.filter((r) => now - r.at < 90_000).length;
  const heat = Math.min(100, lockingNow * 18 + Math.min(40, poll.home + poll.draw + poll.away));
  return {
    home: poll.home,
    draw: poll.draw,
    away: poll.away,
    total: poll.home + poll.draw + poll.away,
    updated: poll.updated,
    lockingNow,
    heat,
    recent: recent.map((r) => ({
      side: r.side,
      tag: r.tag,
      ago: Math.max(0, Math.round((now - r.at) / 1000)),
    })),
  };
}

/** @deprecated use publicPoll */
export function tallies(poll: FixturePoll) {
  return publicPoll(poll);
}
