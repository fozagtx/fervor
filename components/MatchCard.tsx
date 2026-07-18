"use client";

import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import type { MatchState } from "@/lib/txline/types";
import { dramaScore } from "@/lib/drama";
import { flagOf } from "@/lib/flags";
import DramaMeter from "./DramaMeter";
import { COLORS } from "./PulseChart";

function isLive(m: MatchState): boolean {
  const g = m.gameState.toLowerCase();
  return !/(sched|await|ft|full|final|ended|finish)/.test(g) && m.probs.length > 0;
}

function isFinished(m: MatchState): boolean {
  return /(ft|full|final|ended|finish)/.test(m.gameState.toLowerCase());
}

export default function MatchCard({ match }: { match: MatchState }) {
  const router = useRouter();
  const live = isLive(match);
  const finished = isFinished(match);
  const latest = match.probs[match.probs.length - 1];

  return (
    <Card
      isPressable
      shadow="sm"
      className={`w-full border-small ${
        live
          ? "border-primary-300 shadow-[0_0_18px_-4px_rgba(15,138,82,0.35)] dark:shadow-[0_0_18px_-4px_rgba(16,185,129,0.4)]"
          : "border-default-200"
      }`}
      onPress={() => router.push(`/match/${match.fixtureId}`)}
    >
      <CardBody className="gap-2 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Teams, stacked like a fixture row */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <TeamLine name={match.home} score={live || finished ? match.scoreHome : null} />
            <TeamLine name={match.away} score={live || finished ? match.scoreAway : null} />
          </div>

          {/* Right rail: state */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            {live ? (
              <>
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="font-semibold"
                  startContent={
                    <span className="live-dot ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  }
                >
                  {match.minute ? `${Math.floor(match.minute)}′` : "LIVE"}
                </Chip>
                <DramaMeter score={dramaScore(match)} compact />
              </>
            ) : finished ? (
              <span className="text-tiny font-medium uppercase text-default-400">FT</span>
            ) : (
              <span className="text-tiny text-default-400">
                {new Date(match.startTime).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <Icon icon="solar:alt-arrow-right-linear" className="text-default-300" width={14} />
          </div>
        </div>

        {latest ? (
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-right font-mono text-tiny" style={{ color: COLORS.home }}>
              {latest.home.toFixed(0)}%
            </span>
            <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-default-100">
              <div style={{ width: `${latest.home}%`, background: COLORS.home }} className="transition-all duration-700" />
              <div style={{ width: `${latest.draw}%`, background: COLORS.draw, opacity: 0.6 }} className="transition-all duration-700" />
              <div style={{ width: `${latest.away}%`, background: COLORS.away }} className="transition-all duration-700" />
            </div>
            <span className="w-8 shrink-0 font-mono text-tiny" style={{ color: COLORS.away }}>
              {latest.away.toFixed(0)}%
            </span>
          </div>
        ) : (
          !finished && (
            <p className="text-tiny text-default-400">
              <Icon icon="solar:clock-circle-linear" width={12} className="mr-1 inline" />
              The market opens closer to kick-off
            </p>
          )
        )}
      </CardBody>
    </Card>
  );
}

function TeamLine({ name, score }: { name: string; score: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 shrink-0 text-medium leading-none">{flagOf(name)}</span>
      <span className="min-w-0 flex-1 truncate text-small font-medium">{name}</span>
      {score !== null && (
        <span className="shrink-0 pr-1 font-mono text-small font-semibold tabular-nums">{score}</span>
      )}
    </div>
  );
}
