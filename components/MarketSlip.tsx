"use client";

import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { flagOf } from "@/lib/flags";
import { playerId } from "@/lib/player";
import type { MatchState } from "@/lib/txline/types";
import FomoStrip, { type FomoRecent } from "./FomoStrip";
import { COLORS } from "./WaveChart";

type Side = "home" | "draw" | "away";

interface Tallies {
  home: number;
  draw: number;
  away: number;
  total: number;
  lockingNow: number;
  heat: number;
  recent: FomoRecent[];
}

function pct(n: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

/** SportyBet-style decimal “price” from win % — display only, no stake. */
function priceFromProb(prob: number | undefined): string {
  if (prob == null || prob < 1) return "—";
  const d = Math.min(25, Math.max(1.01, 100 / prob));
  return d.toFixed(2);
}

/**
 * TikTok × SportyBet market slip: big 1X2 tiles + live FOMO.
 * Lock a free call — crowd heat + market prices. No money.
 */
export default function MarketSlip({ match }: { match: MatchState }) {
  const [tallies, setTallies] = useState<Tallies>({
    home: 0,
    draw: 0,
    away: 0,
    total: 0,
    lockingNow: 0,
    heat: 0,
    recent: [],
  });
  const [yours, setYours] = useState<Side | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Side | null>(null);
  const [justLocked, setJustLocked] = useState(false);
  const latest = match.probs[match.probs.length - 1];
  const finished = /(ft|full|final|ended|finish)/i.test(match.gameState);

  const applyPayload = (d: Record<string, unknown>) => {
    setTallies({
      home: Number(d.home) || 0,
      draw: Number(d.draw) || 0,
      away: Number(d.away) || 0,
      total: Number(d.total) || 0,
      lockingNow: Number(d.lockingNow) || 0,
      heat: Number(d.heat) || 0,
      recent: Array.isArray(d.recent) ? (d.recent as FomoRecent[]) : [],
    });
  };

  const load = useCallback(() => {
    fetch(`/api/who-wins?fixture=${match.fixtureId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        applyPayload(d);
      })
      .catch(() => {});
  }, [match.fixtureId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    try {
      const saved = localStorage.getItem(`torq-who-${match.fixtureId}`) as Side | null;
      if (saved === "home" || saved === "draw" || saved === "away") setYours(saved);
    } catch {
      // ignore
    }
    return () => clearInterval(t);
  }, [load, match.fixtureId]);

  const vote = async (side: Side) => {
    if (finished || busy) return;
    setBusy(true);
    setYours(side);
    setFlash(side);
    setJustLocked(true);
    window.setTimeout(() => setFlash(null), 420);
    window.setTimeout(() => setJustLocked(false), 2200);
    try {
      localStorage.setItem(`torq-who-${match.fixtureId}`, side);
    } catch {
      // ignore
    }
    try {
      const res = await fetch("/api/who-wins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: match.fixtureId, side, player: playerId() }),
      });
      const d = await res.json();
      if (res.ok) applyPayload(d);
    } catch {
      // optimistic
    } finally {
      setBusy(false);
    }
  };

  const crowdFav: Side | null =
    tallies.total > 0
      ? tallies.home >= tallies.draw && tallies.home >= tallies.away
        ? "home"
        : tallies.away >= tallies.home && tallies.away >= tallies.draw
          ? "away"
          : "draw"
      : null;

  const label = (s: Side) => (s === "home" ? match.home : s === "away" ? match.away : "Draw");

  const tiles: { side: Side; name: string; code: string; prob?: number; color: string }[] = [
    { side: "home", name: match.home, code: "1", prob: latest?.home, color: COLORS.home },
    { side: "draw", name: "Draw", code: "X", prob: latest?.draw, color: COLORS.draw },
    { side: "away", name: match.away, code: "2", prob: latest?.away, color: COLORS.away },
  ];

  const hotSide =
    tallies.lockingNow > 0 && crowdFav
      ? crowdFav
      : tallies.total >= 3
        ? crowdFav
        : null;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon icon="solar:chart-bold-duotone" className="text-emerald-600" width={16} />
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-800">
            Match result · 1X2
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {tallies.lockingNow > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              {tallies.lockingNow} live
            </span>
          )}
          <p className="font-mono text-[10px] text-zinc-400">
            {tallies.total > 0 ? `${tallies.total} locked` : "Free · no stake"}
          </p>
        </div>
      </div>

      <FomoStrip
        match={match}
        lockingNow={tallies.lockingNow}
        heat={tallies.heat}
        recent={tallies.recent}
        total={tallies.total}
      />

      <div className="grid grid-cols-3 gap-2">
        {tiles.map(({ side, name, code, prob, color }) => {
          const selected = yours === side;
          const crowd = pct(tallies[side], tallies.total);
          const trending = hotSide === side && !selected;
          return (
            <button
              key={side}
              type="button"
              disabled={finished || busy}
              onClick={(e) => {
                e.stopPropagation();
                vote(side);
              }}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl border-2 px-1.5 py-3 transition-all active:scale-[0.97] ${
                selected
                  ? "border-emerald-500 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                  : trending
                    ? "border-amber-300 bg-amber-50/80 hover:border-amber-400"
                    : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
              } ${flash === side ? "scale-[1.03]" : ""}`}
            >
              {trending && (
                <span className="absolute -top-1.5 right-1 rounded-full bg-amber-500 px-1.5 py-px font-mono text-[8px] font-bold uppercase text-white">
                  hot
                </span>
              )}
              <span className="font-mono text-[10px] font-bold text-zinc-400">{code}</span>
              <span className="max-w-full truncate text-[11px] font-semibold text-zinc-800">
                {side === "draw" ? "Draw" : flagOf(name)} {side !== "draw" ? name.split(" ")[0] : ""}
              </span>
              <span
                className="font-mono text-xl font-bold tabular-nums leading-none"
                style={{ color: selected ? "#059669" : color }}
              >
                {priceFromProb(prob)}
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                {prob != null ? `${prob.toFixed(0)}% mkt` : "—"}
              </span>
              {tallies.total > 0 && (
                <span className="mt-0.5 rounded-full bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold text-zinc-500 ring-1 ring-zinc-200">
                  {crowd}% fans
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="transition-all duration-500"
          style={{ width: `${pct(tallies.home, tallies.total)}%`, background: COLORS.home }}
        />
        <div
          className="transition-all duration-500"
          style={{
            width: `${pct(tallies.draw, tallies.total)}%`,
            background: COLORS.draw,
            opacity: 0.65,
          }}
        />
        <div
          className="transition-all duration-500"
          style={{ width: `${pct(tallies.away, tallies.total)}%`, background: COLORS.away }}
        />
      </div>

      <p className="text-center text-[11px] text-zinc-500">
        {finished ? (
          yours ? (
            <>
              Poll closed · you locked{" "}
              <span className="font-semibold text-zinc-800">{label(yours)}</span>
            </>
          ) : (
            "Poll closed — you missed this one"
          )
        ) : justLocked ? (
          <span className="font-semibold text-emerald-700">Locked in — don&apos;t miss the next swing</span>
        ) : yours ? (
          crowdFav && yours !== crowdFav && tallies.total >= 5 ? (
            <>
              FOMO check — you&apos;re fading{" "}
              <span className="font-semibold text-amber-700">
                {pct(tallies[crowdFav], tallies.total)}%
              </span>{" "}
              on {label(crowdFav)}
            </>
          ) : (
            <>
              You&apos;re in on <span className="font-semibold text-emerald-700">{label(yours)}</span>
              {tallies.lockingNow > 0 ? " · room still filling" : ""}
            </>
          )
        ) : tallies.lockingNow > 0 ? (
          <span className="font-semibold text-amber-700">
            {tallies.lockingNow} locking now — jump in
          </span>
        ) : (
          "Tap a side before the room runs away"
        )}
      </p>
    </div>
  );
}
