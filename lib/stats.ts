"use client";

export interface CallStats {
  streak: number;
  best: number;
  wins: number;
  plays: number;
  points: number;
}

export const EMPTY_STATS: CallStats = { streak: 0, best: 0, wins: 0, plays: 0, points: 0 };

const keyFor = (address: string | null) =>
  address ? `matchpulse-market-stats:${address}` : "matchpulse-market-stats";

export function loadStats(address: string | null): CallStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    return { ...EMPTY_STATS, ...JSON.parse(localStorage.getItem(keyFor(address)) || "{}") };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(address: string | null, stats: CallStats) {
  try {
    localStorage.setItem(keyFor(address), JSON.stringify(stats));
  } catch {
    // private browsing
  }
}

/** First connect adopts the guest record so nobody loses a streak. */
export function adoptGuestStats(address: string): CallStats {
  const wallet = loadStats(address);
  if (wallet.plays > 0) return wallet;
  const guest = loadStats(null);
  if (guest.plays > 0) saveStats(address, guest);
  return guest.plays > 0 ? guest : wallet;
}
