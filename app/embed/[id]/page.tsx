"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Flag from "@/components/Flag";
import WaveChart from "@/components/WaveChart";
import { dramaScore } from "@/lib/drama";
import { useMatchStream } from "@/lib/useMatchStream";
import { COLORS } from "@/components/WaveChart";

/**
 * Streamer / TV embed — no chrome, iframe-safe, live river + score.
 * Usage: <iframe src="https://torq.up.railway.app/embed/FIXTURE_ID" />
 */
export default function EmbedPage() {
  const params = useParams<{ id: string }>();
  const fixtureId = Number(params.id);
  const { matches, connected } = useMatchStream({ fixtureId });
  const match = matches.get(fixtureId);

  if (!match) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#0a0a0a] text-white/50">
        <span className="live-dot mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
        {connected ? "Loading match…" : "Connecting…"}
      </main>
    );
  }

  const g = match.gameState.toLowerCase();
  const live = !/(sched|await|ft|full|final|ended|finish)/.test(g) && match.probs.length > 0;
  const finished = /(ft|full|final|ended|finish)/.test(g);
  const latest = match.probs[match.probs.length - 1];
  const drama = live ? dramaScore(match) : 0;

  return (
    <main className="flex h-dvh flex-col gap-2 bg-[#0a0a0a] px-3 py-2.5 text-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Flag team={match.home} size="sm" />
          <span className="truncate text-xs font-semibold">{match.home}</span>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <p className="font-mono text-xl font-bold tabular-nums leading-none">
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
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <span className="truncate text-xs font-semibold">{match.away}</span>
          <Flag team={match.away} size="sm" />
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

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white/[0.04] px-1">
        {match.probs.length > 2 ? (
          <WaveChart
            probs={match.probs}
            events={match.events}
            home={match.home}
            away={match.away}
          />
        ) : (
          <p className="flex h-full items-center justify-center text-[10px] text-white/35">
            Market opens near kick-off
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">Torq</span>
        <Link
          href={`/match/${fixtureId}`}
          target="_blank"
          className="text-[10px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
        >
          Open full match
        </Link>
      </div>
    </main>
  );
}
