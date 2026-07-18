"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "torq-favorites";
const ID_KEY = "torq-follow-id";

function newFollowId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function getFollowId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = newFollowId();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return newFollowId();
  }
}

function syncFollows(teams: string[]) {
  const id = getFollowId();
  if (!id) return;
  fetch("/api/follows", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, teams }),
  }).catch(() => {});
}

/** Favorite teams, the single most loved feature of football apps. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [followId, setFollowId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(KEY) || "[]"));
      setFollowId(getFollowId());
    } catch {
      // fresh start
    }
    setReady(true);
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
      syncFollows(next);
      return next;
    });
  }, []);

  return { favorites, toggle, followId, ready };
}

export function favScore(m: { home: string; away: string }, favorites: string[]): number {
  return (favorites.includes(m.home) ? 1 : 0) + (favorites.includes(m.away) ? 1 : 0);
}

/** "in 2d 4h" / "in 8h 45m" / "in 12m" / "KO soon", ticking; null once due or far away. */
export function useCountdown(target: number): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  const diff = target - Date.now();
  if (diff <= 0) return null;
  if (diff > 72 * 3600000) return null;
  if (diff < 15 * 60000) return "KO soon";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `in ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

export function formatCountdown(target: number, now = Date.now()): string | null {
  const diff = target - now;
  if (diff <= 0 || diff > 72 * 3600000) return null;
  if (diff < 15 * 60000) return "KO soon";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `in ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}
