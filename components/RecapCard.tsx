"use client";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { MatchState } from "@/lib/txline/types";
import { biggestSwing, dramaPeak } from "@/lib/drama";
import { COLORS } from "./PulseChart";

interface CallStats {
  wins: number;
  plays: number;
  points?: number;
  best?: number;
}

function loadStats(): CallStats {
  try {
    return { wins: 0, plays: 0, ...JSON.parse(localStorage.getItem("matchpulse-market-stats") || "{}") };
  } catch {
    return { wins: 0, plays: 0 };
  }
}

export default function RecapCard({ match }: { match: MatchState }) {
  const swing = biggestSwing(match.probs);
  const peak = dramaPeak(match);
  const stats = loadStats();
  const goals = match.events.filter((e) => e.kind === "goal").length;

  const share = async () => {
    const swingText = swing
      ? `Biggest market swing: ${swing.side === "home" ? match.home : match.away} ${swing.delta > 0 ? "+" : ""}${swing.delta}pp in 5 min.`
      : "";
    const text = `${match.home} ${match.scoreHome}–${match.scoreAway} ${match.away}. Drama peak ${peak}/100. ${swingText} Felt on Match Pulse ⚽📈`;
    try {
      if (navigator.share) await navigator.share({ text, url: location.origin });
      else await navigator.clipboard.writeText(`${text} ${location.origin}`);
    } catch {
      // user dismissed share sheet
    }
  };

  return (
    <Card shadow="sm" className="border-small border-warning-200/40">
      <CardBody className="gap-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="solar:flag-2-bold-duotone" className="text-warning" width={18} />
            <p className="text-medium font-semibold">Full-time recap</p>
          </div>
          <Chip size="sm" variant="flat" className="font-mono text-default-500">
            {match.scoreHome}–{match.scoreAway}
          </Chip>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <RecapStat
            icon="solar:fire-bold-duotone"
            label="Drama peak"
            value={`${peak}`}
            sub="/100"
            color="#F5A524"
          />
          <RecapStat
            icon="solar:graph-up-bold-duotone"
            label="Biggest swing"
            value={swing ? `${swing.delta > 0 ? "+" : ""}${swing.delta}` : "–"}
            sub={swing ? `pp · ${swing.side === "home" ? match.home : match.away}` : ""}
            color={swing && swing.side === "home" ? COLORS.home : COLORS.away}
          />
          <RecapStat
            icon="solar:football-bold-duotone"
            label="Goals"
            value={`${goals}`}
            sub={match.minute ? `in ${Math.round(match.minute)}′` : ""}
            color="#FAFAFA"
          />
        </div>

        {stats.plays > 0 && (
          <div className="flex items-center justify-between rounded-medium border-small border-default-200 bg-default-50 px-3 py-2">
            <p className="text-small">
              Your calls: <span className="font-mono font-semibold">{stats.wins}/{stats.plays}</span>
              {stats.points ? (
                <span className="ml-2 font-mono text-warning">{stats.points} pts</span>
              ) : null}
            </p>
            <Icon icon="solar:cup-star-bold-duotone" className="text-warning" width={18} />
          </div>
        )}

        <Button
          color="primary"
          radius="full"
          startContent={<Icon icon="solar:share-bold" width={17} />}
          onPress={share}
        >
          Share this match
        </Button>
      </CardBody>
    </Card>
  );
}

function RecapStat({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-medium border-small border-default-200 bg-default-50 px-2 py-3 text-center">
      <Icon icon={icon} width={18} style={{ color }} />
      <p className="font-mono text-xl font-semibold leading-none">
        {value}
        <span className="text-tiny text-default-400">{sub}</span>
      </p>
      <p className="text-tiny text-default-400">{label}</p>
    </div>
  );
}
