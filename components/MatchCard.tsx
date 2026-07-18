"use client";

import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import type { MatchState } from "@/lib/txline/types";
import { dramaScore } from "@/lib/drama";
import { useCountdown } from "@/lib/favorites";
import { flagOf } from "@/lib/flags";
import DramaMeter from "./DramaMeter";
import WhoWins from "./WhoWins";
import { COLORS } from "./WaveChart";

function isLive(m: MatchState): boolean {
  const g = m.gameState.toLowerCase();
  return !/(sched|await|ft|full|final|ended|finish)/.test(g) && m.probs.length > 0;
}

function isFinished(m: MatchState): boolean {
  return /(ft|full|final|ended|finish)/.test(m.gameState.toLowerCase());
}

export default function MatchCard({
  match,
  favorites = [],
  onToggleFavorite,
}: {
  match: MatchState;
  favorites?: string[];
  onToggleFavorite?: (team: string) => void;
}) {
  const router = useRouter();
  const live = isLive(match);
  const finished = isFinished(match);
  const latest = match.probs[match.probs.length - 1];
  const countdown = useCountdown(match.startTime);
  const href = finished ? `/match/${match.fixtureId}?replay=1` : `/match/${match.fixtureId}`;

  return (
    <Card
      isPressable
      shadow="none"
      className={`h-full w-full border-small ${
        live
          ? "border-primary-300 bg-primary-50/40 dark:bg-primary-950/30"
          : finished
            ? "border-secondary-200"
            : "border-default-200"
      }`}
      onPress={() => router.push(href)}
    >
      <CardBody className="gap-2.5 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <StatusBadge live={live} finished={finished} match={match} countdown={countdown} />
          {onToggleFavorite && (
            <button
              aria-label="Toggle favorites"
              className="shrink-0 rounded-full p-0.5 text-default-300 hover:text-warning"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Star the home side as the follow toggle for this card
                onToggleFavorite(match.home);
              }}
            >
              <Icon
                icon={favorites.includes(match.home) ? "solar:star-bold" : "solar:star-linear"}
                width={14}
                className={favorites.includes(match.home) ? "text-warning" : undefined}
              />
            </button>
          )}
        </div>

        {/* Home — vs/score — Away */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-lg leading-none">{flagOf(match.home)}</span>
            <span className="truncate text-small font-semibold">{match.home}</span>
          </div>
          <div className="flex flex-col items-center px-1">
            <span className="font-mono text-lg font-bold tabular-nums leading-none">
              {live || finished ? (
                <>
                  {match.scoreHome}
                  <span className="px-0.5 text-default-300">–</span>
                  {match.scoreAway}
                </>
              ) : (
                <span className="text-default-400">vs</span>
              )}
            </span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <span className="truncate text-right text-small font-semibold">{match.away}</span>
            <span className="shrink-0 text-lg leading-none">{flagOf(match.away)}</span>
          </div>
        </div>

        {latest ? (
          <div className="flex items-center gap-1.5">
            <span className="w-7 shrink-0 text-right font-mono text-[10px]" style={{ color: COLORS.home }}>
              {latest.home.toFixed(0)}%
            </span>
            <div className="flex h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-default-100">
              <div
                style={{ width: `${latest.home}%`, background: COLORS.home }}
                className="transition-all duration-700"
              />
              <div
                style={{ width: `${latest.draw}%`, background: COLORS.draw, opacity: 0.55 }}
                className="transition-all duration-700"
              />
              <div
                style={{ width: `${latest.away}%`, background: COLORS.away }}
                className="transition-all duration-700"
              />
            </div>
            <span className="w-7 shrink-0 font-mono text-[10px]" style={{ color: COLORS.away }}>
              {latest.away.toFixed(0)}%
            </span>
            {live && <DramaMeter score={dramaScore(match)} compact />}
          </div>
        ) : (
          !finished && (
            <p className="text-center text-[10px] text-default-400">Market opens nearer kick-off</p>
          )
        )}

        {!finished && <WhoWins match={match} compact />}
      </CardBody>
    </Card>
  );
}

function StatusBadge({
  live,
  finished,
  match,
  countdown,
}: {
  live: boolean;
  finished: boolean;
  match: MatchState;
  countdown: string | null;
}) {
  if (live) {
    return (
      <Chip
        size="sm"
        variant="flat"
        color="primary"
        className="h-5 font-semibold"
        startContent={<span className="live-dot ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
      >
        {match.minute ? `${Math.floor(match.minute)}′` : "LIVE"}
      </Chip>
    );
  }
  if (finished) {
    return (
      <Chip
        size="sm"
        variant="flat"
        color="secondary"
        className="h-5 font-semibold"
        startContent={<Icon icon="solar:play-bold" width={10} className="ml-1" />}
      >
        Replay
      </Chip>
    );
  }
  if (countdown) {
    return (
      <span className="font-mono text-[11px] font-semibold text-primary">{countdown}</span>
    );
  }
  return (
    <span className="text-[11px] text-default-400">
      {new Date(match.startTime).toLocaleString(undefined, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );
}
