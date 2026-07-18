"use client";

import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import type { MatchState } from "@/lib/txline/types";
import { dramaScore } from "@/lib/drama";
import DramaMeter from "./DramaMeter";
import { COLORS } from "./PulseChart";

function isLive(m: MatchState): boolean {
  const g = m.gameState.toLowerCase();
  return !/(sched|not|pre|ft|full|final|ended|finish)/.test(g) && m.probs.length > 0;
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
      className="w-full border-small border-default-200"
      onPress={() => router.push(`/match/${match.fixtureId}`)}
    >
      <CardBody className="gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-medium font-semibold">
              {match.home} <span className="text-default-400">vs</span> {match.away}
            </p>
            <p className="text-tiny text-default-400">
              {live
                ? `${match.minute ? `${Math.floor(match.minute)}′ · ` : ""}${match.gameState}`
                : finished
                  ? "Full-time"
                  : new Date(match.startTime).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {live && <DramaMeter score={dramaScore(match)} compact />}
            {(live || finished) && (
              <p className="font-mono text-xl font-semibold tabular-nums">
                {match.scoreHome}–{match.scoreAway}
              </p>
            )}
            {live ? (
              <Chip
                size="sm"
                variant="flat"
                color="primary"
                startContent={<span className="live-dot ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
              >
                LIVE
              </Chip>
            ) : (
              <Icon icon="solar:alt-arrow-right-linear" className="text-default-400" width={18} />
            )}
          </div>
        </div>

        {!latest && !finished && (
          <p className="text-tiny text-default-400">
            <Icon icon="solar:clock-circle-linear" width={12} className="mr-1 inline" />
            The market opens closer to kick-off
          </p>
        )}

        {latest && (
          <div className="flex flex-col gap-1.5">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-default-100">
              <div style={{ width: `${latest.home}%`, background: COLORS.home }} className="transition-all duration-700" />
              <div style={{ width: `${latest.draw}%`, background: COLORS.draw, opacity: 0.7 }} className="transition-all duration-700" />
              <div style={{ width: `${latest.away}%`, background: COLORS.away }} className="transition-all duration-700" />
            </div>
            <div className="flex justify-between text-tiny text-default-400">
              <span style={{ color: COLORS.home }} className="font-mono font-medium">
                {latest.home.toFixed(0)}%
              </span>
              <span className="font-mono">draw {latest.draw.toFixed(0)}%</span>
              <span style={{ color: COLORS.away }} className="font-mono font-medium">
                {latest.away.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
