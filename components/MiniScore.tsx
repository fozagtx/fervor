"use client";

import { useRouter } from "next/navigation";
import { useMatchStream } from "@/lib/useMatchStream";
import Flag from "./Flag";
import { COLORS } from "./WaveChart";

/**
 * Compact scoreboard for the floating popup AND for /mini/[id] in a tab.
 * Full-bleed dark stage — no mascot, no chrome junk.
 */
export default function MiniScore({ fixtureId }: { fixtureId: number }) {
  const router = useRouter();
  const { matches } = useMatchStream({ fixtureId });
  const match = matches.get(fixtureId);

  if (!match) {
    return (
      <main
        data-torq-mini
        className="flex h-dvh w-full items-center justify-center bg-black"
      >
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
      </main>
    );
  }

  const g = match.gameState.toLowerCase();
  const finished = /(ft|full|final|ended|finish)/.test(g);
  const live =
    !finished &&
    !/(sched|await|not|pre)/.test(g) &&
    match.probs.length > 0;
  const latest = match.probs[match.probs.length - 1];
  const showScore = live || finished;

  return (
    <main
      data-torq-mini
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/match/${fixtureId}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/match/${fixtureId}`);
        }
      }}
      className="flex h-dvh w-full cursor-pointer flex-col justify-center gap-3 bg-black px-5 py-4 text-white outline-none select-none"
      aria-label={`${match.home} ${match.scoreHome}–${match.scoreAway} ${match.away}. Open full match.`}
    >
      {/* Teams + score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 flex-col items-center gap-1.5">
          <Flag team={match.home} size="lg" />
          <span className="w-full truncate text-center text-xs font-semibold tracking-tight">
            {match.home}
          </span>
        </div>

        <div className="flex flex-col items-center px-1">
          <p className="font-mono text-4xl font-bold tabular-nums leading-none tracking-tight">
            {showScore ? (
              <>
                {match.scoreHome}
                <span className="px-1.5 text-white/25">–</span>
                {match.scoreAway}
              </>
            ) : (
              <span className="text-2xl font-medium text-white/40">vs</span>
            )}
          </p>
          <span className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {live ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
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

        <div className="flex min-w-0 flex-col items-center gap-1.5">
          <Flag team={match.away} size="lg" />
          <span className="w-full truncate text-center text-xs font-semibold tracking-tight">
            {match.away}
          </span>
        </div>
      </div>

      {/* Win % bar — only when we have a real market */}
      {latest && (latest.home > 0 || latest.away > 0) && (
        <div className="flex items-center gap-2">
          <span
            className="w-8 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums"
            style={{ color: COLORS.home }}
          >
            {latest.home.toFixed(0)}%
          </span>
          <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              style={{ width: `${latest.home}%`, background: COLORS.home }}
              className="transition-all duration-700"
            />
            <div
              style={{ width: `${latest.draw}%`, background: COLORS.draw, opacity: 0.5 }}
              className="transition-all duration-700"
            />
            <div
              style={{ width: `${latest.away}%`, background: COLORS.away }}
              className="transition-all duration-700"
            />
          </div>
          <span
            className="w-8 shrink-0 font-mono text-[11px] font-semibold tabular-nums"
            style={{ color: COLORS.away }}
          >
            {latest.away.toFixed(0)}%
          </span>
        </div>
      )}
    </main>
  );
}
