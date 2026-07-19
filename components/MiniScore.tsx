"use client";

import { useEffect } from "react";
import { useMatchStream } from "@/lib/useMatchStream";
import Flag from "./Flag";
import { COLORS } from "./WaveChart";

/**
 * Tiny popup scoreboard (380×~110). Never stretches.
 * Full browser tabs never land here - middleware requires ?p=1.
 */
export default function MiniScore({ fixtureId }: { fixtureId: number }) {
  const { matches } = useMatchStream({ fixtureId });
  const match = matches.get(fixtureId);

  useEffect(() => {
    document.documentElement.setAttribute("data-torq-mini-root", "1");
    document.body.setAttribute("data-torq-mini-root", "1");
    return () => {
      document.documentElement.removeAttribute("data-torq-mini-root");
      document.body.removeAttribute("data-torq-mini-root");
    };
  }, []);

  // If someone strips ?p=1 client-side, bounce to full match.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("p")) {
      window.location.replace(`/match/${fixtureId}`);
    }
  }, [fixtureId]);

  if (!match) {
    return (
      <main
        data-torq-mini
        className="box-border flex h-[96px] w-[380px] max-w-full items-center justify-center bg-white"
      >
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
      </main>
    );
  }

  const g = match.gameState.toLowerCase();
  const finished = /(ft|full|final|ended|finish)/.test(g);
  const live =
    !finished && !/(sched|await|not|pre)/.test(g) && match.probs.length > 0;
  const latest = match.probs[match.probs.length - 1];
  const showScore = live || finished;
  const hasMarket = Boolean(latest && (latest.home > 0 || latest.away > 0));

  return (
    <main
      data-torq-mini
      role="link"
      tabIndex={0}
      onClick={() => {
        window.location.href = `/match/${fixtureId}`;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = `/match/${fixtureId}`;
        }
      }}
      className="box-border flex w-[380px] max-w-full cursor-pointer flex-col gap-1 bg-white px-3 py-2 text-zinc-900 outline-none select-none"
      aria-label={`${match.home} ${match.scoreHome}–${match.scoreAway} ${match.away}`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Flag team={match.home} size="sm" />
          <span className="truncate text-xs font-semibold">{match.home}</span>
        </div>

        <div className="flex flex-col items-center">
          <p className="font-mono text-xl font-bold tabular-nums leading-none">
            {showScore ? (
              <>
                {match.scoreHome}
                <span className="px-0.5 text-zinc-300">–</span>
                {match.scoreAway}
              </>
            ) : (
              <span className="text-base font-medium text-zinc-400">vs</span>
            )}
          </p>
          <span className="mt-0.5 font-mono text-[10px] font-semibold uppercase text-zinc-400">
            {live ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {match.minute != null ? `${Math.floor(match.minute)}′` : "LIVE"}
              </span>
            ) : finished ? (
              "FT"
            ) : (
              new Date(match.startTime).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })
            )}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <span className="truncate text-right text-xs font-semibold">{match.away}</span>
          <Flag team={match.away} size="sm" />
        </div>
      </div>

      {hasMarket && latest && (
        <div className="flex items-center gap-1.5">
          <span
            className="w-7 shrink-0 text-right font-mono text-[10px] font-semibold tabular-nums"
            style={{ color: COLORS.home }}
          >
            {latest.home.toFixed(0)}%
          </span>
          <div className="flex h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div style={{ width: `${latest.home}%`, background: COLORS.home }} />
            <div
              style={{ width: `${latest.draw}%`, background: COLORS.draw, opacity: 0.55 }}
            />
            <div style={{ width: `${latest.away}%`, background: COLORS.away }} />
          </div>
          <span
            className="w-7 shrink-0 font-mono text-[10px] font-semibold tabular-nums"
            style={{ color: COLORS.away }}
          >
            {latest.away.toFixed(0)}%
          </span>
        </div>
      )}
    </main>
  );
}
