"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { flagOf } from "@/lib/flags";
import type { MatchState } from "@/lib/txline/types";
import { dramaScore } from "@/lib/drama";

type Side = "home" | "draw" | "away";

export interface FomoRecent {
  side: Side;
  tag: string;
  ago: number;
}

function agoLabel(sec: number) {
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function sideName(match: MatchState, side: Side) {
  if (side === "home") return match.home.split(" ")[0];
  if (side === "away") return match.away.split(" ")[0];
  return "Draw";
}

/** Live FOMO ticker - recent locks + heat + urgency. */
export default function FomoStrip({
  match,
  lockingNow = 0,
  heat = 0,
  recent = [],
  total = 0,
}: {
  match: MatchState;
  lockingNow?: number;
  heat?: number;
  recent?: FomoRecent[];
  total?: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const finished = /(ft|full|final|ended|finish)/i.test(match.gameState);
  const live = !finished && !/(sched|not|pre|await)/i.test(match.gameState);
  const msToKo = match.startTime - Date.now();
  const koSoon = !live && !finished && msToKo > 0 && msToKo < 45 * 60 * 1000;
  const drama = live ? dramaScore(match) : 0;

  const lines: string[] = [];
  if (lockingNow > 0) {
    lines.push(`${lockingNow} fan${lockingNow === 1 ? "" : "s"} locking in right now`);
  }
  if (recent[0]) {
    const r = recent[tick % recent.length] ?? recent[0];
    const who =
      r.side === "draw"
        ? "Draw"
        : `${flagOf(r.side === "home" ? match.home : match.away)} ${sideName(match, r.side)}`;
    lines.push(`fan_${r.tag} locked ${who} · ${agoLabel(r.ago)}`);
  }
  if (koSoon) {
    const m = Math.ceil(msToKo / 60000);
    lines.push(`Kick-off in ${m}m - calls close when FT hits`);
  }
  if (drama >= 55) {
    lines.push(`Drama ${drama}/100 - market is moving hard`);
  }
  if (total >= 10 && !lockingNow) {
    lines.push(`${total} fans already in this market`);
  }
  if (lines.length === 0) {
    lines.push(finished ? "Market closed - see who called it" : "Be first - lock a side before the room fills");
  }

  const line = lines[tick % lines.length];
  const hot = lockingNow > 0 || drama >= 55 || heat >= 40;

  return (
    <div
      className={`flex items-center gap-2 overflow-hidden rounded-xl px-2.5 py-1.5 ${
        hot
          ? "border border-amber-200 bg-amber-50 text-amber-900"
          : "border border-zinc-200 bg-zinc-50 text-zinc-600"
      }`}
    >
      <Icon
        icon={hot ? "solar:fire-bold" : "solar:users-group-rounded-bold-duotone"}
        width={14}
        className={hot ? "shrink-0 text-amber-500" : "shrink-0 text-zinc-400"}
      />
      <p key={`${tick}-${line}`} className="min-w-0 flex-1 truncate text-[11px] font-medium animate-[fomo-in_0.35s_ease-out]">
        {line}
      </p>
      {heat > 0 && (
        <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wide opacity-70">
          heat {heat}
        </span>
      )}
      <style>{`
        @keyframes fomo-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
