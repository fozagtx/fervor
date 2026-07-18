"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { dramaScore } from "@/lib/drama";
import Mascot from "@/components/Mascot";
import { flagOf } from "@/lib/flags";
import { useMatchStream } from "@/lib/useMatchStream";
import { COLORS } from "./WaveChart";

/** Island-style compact scoreboard for a floating mini window (~380×150). */
export default function MiniScore({ fixtureId }: { fixtureId: number }) {
  const { matches } = useMatchStream({ fixtureId });
  const match = matches.get(fixtureId);

  if (!match) {
    return (
      <main
        data-torq-mini
        className="flex h-full min-h-[120px] items-center justify-center bg-[#0a0a0a]"
      >
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
      </main>
    );
  }

  const g = match.gameState.toLowerCase();
  const live = !/(sched|await|ft|full|final|ended|finish)/.test(g) && match.probs.length > 0;
  const finished = /(ft|full|final|ended|finish)/.test(g);
  const latest = match.probs[match.probs.length - 1];
  const drama = live ? dramaScore(match) : 0;

  return (
    <main
      data-torq-mini
      className="relative flex h-full min-h-[120px] flex-col justify-center gap-2.5 overflow-hidden bg-[#0a0a0a] px-4 py-3 text-white"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-xl leading-none">{flagOf(match.home)}</span>
          <span className="truncate text-xs font-semibold">{match.home}</span>
        </div>
        <div className="flex shrink-0 flex-col items-center px-1">
          <p className="font-mono text-xl font-bold leading-none tabular-nums">
            {live || finished ? `${match.scoreHome}–${match.scoreAway}` : "vs"}
          </p>
          <span className="mt-0.5 font-mono text-[10px] text-white/45">
            {live ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {match.minute ? `${Math.floor(match.minute)}′` : "LIVE"}
                {drama >= 45 && <Icon icon="solar:fire-bold" width={10} className="text-amber-400" />}
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
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <span className="truncate text-xs font-semibold">{match.away}</span>
          <span className="shrink-0 text-xl leading-none">{flagOf(match.away)}</span>
        </div>
      </div>

      {latest && (
        <div className="flex items-center gap-1.5">
          <span className="w-7 shrink-0 text-right font-mono text-[10px]" style={{ color: COLORS.home }}>
            {latest.home.toFixed(0)}%
          </span>
          <div className="flex h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
            <div style={{ width: `${latest.home}%`, background: COLORS.home }} className="transition-all duration-700" />
            <div
              style={{ width: `${latest.draw}%`, background: COLORS.draw, opacity: 0.55 }}
              className="transition-all duration-700"
            />
            <div style={{ width: `${latest.away}%`, background: COLORS.away }} className="transition-all duration-700" />
          </div>
          <span className="w-7 shrink-0 font-mono text-[10px]" style={{ color: COLORS.away }}>
            {latest.away.toFixed(0)}%
          </span>
        </div>
      )}

      <span className="pointer-events-none absolute bottom-1 left-2 opacity-80">
        <Mascot size={18} />
      </span>
      <Link
        href={`/match/${fixtureId}`}
        target="_blank"
        className="absolute bottom-1.5 right-2 text-white/35 transition-colors hover:text-white/70"
        aria-label="Open the full match"
      >
        <Icon icon="solar:full-screen-linear" width={12} />
      </Link>
    </main>
  );
}
