"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { dramaScore } from "@/lib/drama";
import { flagOf } from "@/lib/flags";
import { useMatchStream } from "@/lib/useMatchStream";
import { COLORS } from "./PulseChart";

/** Island-style compact scoreboard for a floating mini window. */
export default function MiniScore({ fixtureId }: { fixtureId: number }) {
  const { matches } = useMatchStream({ fixtureId });
  const match = matches.get(fixtureId);

  if (!match) {
    return (
      <main className="flex h-dvh items-center justify-center bg-background">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-primary" />
      </main>
    );
  }

  const g = match.gameState.toLowerCase();
  const live = !/(sched|await|ft|full|final|ended|finish)/.test(g) && match.probs.length > 0;
  const finished = /(ft|full|final|ended|finish)/.test(g);
  const latest = match.probs[match.probs.length - 1];
  const drama = live ? dramaScore(match) : 0;

  return (
    <main className="flex h-dvh flex-col justify-center gap-2 bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl leading-none">{flagOf(match.home)}</span>
          <span className="truncate text-small font-semibold">{match.home}</span>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <p className="font-mono text-2xl font-semibold leading-none tabular-nums">
            {live || finished ? `${match.scoreHome}–${match.scoreAway}` : "vs"}
          </p>
          <span className="pt-0.5 font-mono text-[10px] text-default-400">
            {live ? (
              <span className="flex items-center gap-1 text-primary">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                {match.minute ? `${Math.floor(match.minute)}′` : "LIVE"}
                {drama >= 45 && <Icon icon="solar:fire-bold" width={10} className="text-warning" />}
              </span>
            ) : finished ? (
              "FT"
            ) : (
              new Date(match.startTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
            )}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-small font-semibold">{match.away}</span>
          <span className="text-2xl leading-none">{flagOf(match.away)}</span>
        </div>
      </div>

      {latest && (
        <div className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-right font-mono text-[10px]" style={{ color: COLORS.home }}>
            {latest.home.toFixed(0)}%
          </span>
          <div className="flex h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-default-100">
            <div style={{ width: `${latest.home}%`, background: COLORS.home }} className="transition-all duration-700" />
            <div style={{ width: `${latest.draw}%`, background: COLORS.draw, opacity: 0.6 }} className="transition-all duration-700" />
            <div style={{ width: `${latest.away}%`, background: COLORS.away }} className="transition-all duration-700" />
          </div>
          <span className="w-7 shrink-0 font-mono text-[10px]" style={{ color: COLORS.away }}>
            {latest.away.toFixed(0)}%
          </span>
        </div>
      )}

      <Link
        href={`/match/${fixtureId}`}
        target="_blank"
        className="absolute bottom-1.5 right-2 text-default-300 transition-colors hover:text-default-500"
        aria-label="Open the full match"
      >
        <Icon icon="solar:full-screen-linear" width={11} />
      </Link>
    </main>
  );
}
