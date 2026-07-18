"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "fervor-favorites";

/** Favorite teams, the single most loved feature of football apps. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {
      // fresh start
    }
  }, []);

  const toggle = useCallback((team: string) => {
    setFavorites((current) => {
      const next = current.includes(team)
        ? current.filter((t) => t !== team)
        : [...current, team];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // private browsing
      }
      return next;
    });
  }, []);

  return { favorites, toggle };
}

export function favScore(m: { home: string; away: string }, favorites: string[]): number {
  return (favorites.includes(m.home) ? 1 : 0) + (favorites.includes(m.away) ? 1 : 0);
}

/** "in 2d 4h" / "in 8h 45m" / "in 12m", ticking; null once due or far away. */
export function useCountdown(target: number): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const diff = target - Date.now();
  if (diff <= 0 || diff > 72 * 3600000) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `in ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}
