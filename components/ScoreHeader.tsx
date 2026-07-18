"use client";

import { Card, CardBody, Chip } from "@heroui/react";
import type { MatchState } from "@/lib/txline/types";
import { dramaScore } from "@/lib/drama";
import { flagOf } from "@/lib/flags";
import DramaMeter from "./DramaMeter";
import { COLORS } from "./PulseChart";

export default function ScoreHeader({ match, replay }: { match: MatchState; replay?: boolean }) {
  const g = match.gameState.toLowerCase();
  const live = !/(sched|not|pre|ft|full|final|ended|finish)/.test(g);
  const finished = /(ft|full|final|ended|finish)/.test(g);

  return (
    <Card shadow="sm" className="border-small border-default-200">
      <CardBody className="gap-4 p-5">
        <div className="flex items-center justify-between">
          <Chip size="sm" variant="flat" className="text-default-500">
            {match.competition}
          </Chip>
          {replay ? (
            <Chip size="sm" variant="flat" color="secondary" className="font-mono">
              REPLAY
            </Chip>
          ) : live ? (
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              className="font-semibold"
              startContent={<span className="live-dot ml-1 inline-block h-2 w-2 rounded-full bg-primary" />}
            >
              {match.minute ? `LIVE · ${Math.floor(match.minute)}′` : "LIVE"}
            </Chip>
          ) : (
            <Chip size="sm" variant="flat" className="text-default-500">
              {finished
                ? "Full-time"
                : new Date(match.startTime).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            </Chip>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-start gap-1">
            <span className="text-3xl leading-none">{flagOf(match.home)}</span>
            <p className="text-large font-semibold leading-tight">{match.home}</p>
            <span className="h-1 w-8 rounded-full" style={{ background: COLORS.home }} />
          </div>
          {live || finished || replay ? (
            <p className="px-2 font-mono text-4xl font-semibold tabular-nums">
              {match.scoreHome}
              <span className="px-1 text-default-300">–</span>
              {match.scoreAway}
            </p>
          ) : (
            <p className="px-2 text-2xl font-medium text-default-400">vs</p>
          )}
          <div className="flex flex-col items-end gap-1">
            <span className="text-3xl leading-none">{flagOf(match.away)}</span>
            <p className="text-right text-large font-semibold leading-tight">{match.away}</p>
            <span className="h-1 w-8 rounded-full" style={{ background: COLORS.away }} />
          </div>
        </div>

        <p className="text-center text-tiny capitalize text-default-400">
          {live || finished ? match.gameState : replay ? "Replay" : "Awaiting kick-off"}
        </p>

        {(live || replay) && match.probs.length > 3 && (
          <DramaMeter score={dramaScore(match)} />
        )}
      </CardBody>
    </Card>
  );
}
