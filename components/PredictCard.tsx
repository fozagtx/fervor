"use client";

import { Button, Card, CardBody, CardHeader, Chip, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { MatchState, ProbPoint } from "@/lib/txline/types";
import { COLORS } from "./PulseChart";

const WINDOW_MS = 5 * 60 * 1000; // five minutes of match-feed time

interface Pick {
  side: "home" | "away";
  dir: "up" | "down";
  startProb: number;
  startTs: number;
}

interface Stats {
  streak: number;
  best: number;
  wins: number;
  plays: number;
}

const STATS_KEY = "matchpulse-market-stats";

function loadStats(): Stats {
  if (typeof window === "undefined") return { streak: 0, best: 0, wins: 0, plays: 0 };
  try {
    return { streak: 0, best: 0, wins: 0, plays: 0, ...JSON.parse(localStorage.getItem(STATS_KEY) || "{}") };
  } catch {
    return { streak: 0, best: 0, wins: 0, plays: 0 };
  }
}

export default function PredictCard({ match }: { match: MatchState }) {
  const [side, setSide] = useState<"home" | "away">("home");
  const [pick, setPick] = useState<Pick | null>(null);
  const [result, setResult] = useState<{ won: boolean; from: number; to: number; pick: Pick } | null>(null);
  const [stats, setStats] = useState<Stats>(loadStats);

  const latest = match.probs[match.probs.length - 1];

  // Resolve a pending pick when the feed clock passes the window
  useEffect(() => {
    if (!pick || !latest) return;
    if (latest.ts < pick.startTs + WINDOW_MS) return;
    const current = pick.side === "home" ? latest.home : latest.away;
    const moved = current - pick.startProb;
    const won = pick.dir === "up" ? moved > 0 : moved < 0;
    const next: Stats = {
      plays: stats.plays + 1,
      wins: stats.wins + (won ? 1 : 0),
      streak: won ? stats.streak + 1 : 0,
      best: Math.max(stats.best, won ? stats.streak + 1 : 0),
    };
    setStats(next);
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
    setResult({ won, from: pick.startProb, to: current, pick });
    setPick(null);
  }, [latest, pick, stats]);

  const progress = useMemo(() => {
    if (!pick || !latest) return 0;
    return Math.min(100, ((latest.ts - pick.startTs) / WINDOW_MS) * 100);
  }, [pick, latest]);

  if (!latest) return null;

  const team = side === "home" ? match.home : match.away;
  const teamColor = side === "home" ? COLORS.home : COLORS.away;
  const prob = side === "home" ? latest.home : latest.away;

  const lockPick = (dir: "up" | "down") => {
    setResult(null);
    setPick({ side, dir, startProb: prob, startTs: latest.ts });
  };

  const share = async () => {
    const text = `I'm ${stats.streak > 0 ? `on a ${stats.streak}-call streak` : `${stats.wins}/${stats.plays}`} against the World Cup betting market on Match Pulse ⚽📈`;
    try {
      if (navigator.share) await navigator.share({ text, url: location.origin });
      else await navigator.clipboard.writeText(`${text} ${location.origin}`);
    } catch {
      // user dismissed share sheet
    }
  };

  return (
    <Card shadow="sm" className="border-small border-default-200">
      <CardHeader className="flex-col items-start gap-1 px-5 pb-0 pt-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="solar:cup-star-bold-duotone" className="text-warning" width={18} />
            <p className="text-medium font-semibold">Beat the market</p>
          </div>
          <div className="flex items-center gap-1.5">
            {stats.streak > 1 && (
              <Chip size="sm" variant="flat" color="warning" className="font-mono" startContent={<Icon icon="solar:fire-bold-duotone" width={13} className="ml-1" />}>
                {stats.streak}
              </Chip>
            )}
            {stats.plays > 0 && (
              <Chip size="sm" variant="flat" className="font-mono text-default-500">
                {stats.wins}/{stats.plays}
              </Chip>
            )}
          </div>
        </div>
        <p className="text-tiny text-default-400">
          Call the next move before the bookmakers price it in
        </p>
      </CardHeader>

      <CardBody className="gap-3 p-4 sm:px-5">
        <AnimatePresence mode="wait" initial={false}>
          {pick ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-small">
                  <span style={{ color: pick.side === "home" ? COLORS.home : COLORS.away }} className="font-semibold">
                    {pick.side === "home" ? match.home : match.away}
                  </span>{" "}
                  {pick.dir === "up" ? "to rise" : "to fall"} from{" "}
                  <span className="font-mono font-semibold">{pick.startProb.toFixed(1)}%</span>
                </p>
                <Chip size="sm" variant="flat" color="secondary" className="font-mono">
                  {(side === pick.side ? prob : pick.side === "home" ? latest.home : latest.away).toFixed(1)}%
                </Chip>
              </div>
              <Progress size="sm" value={progress} color="secondary" aria-label="time remaining in this call" />
              <p className="text-center text-tiny text-default-400">
                Locked — settles after 5 minutes of match time
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              {result && (
                <div
                  className={`flex items-center justify-between rounded-medium border-small px-3 py-2 ${
                    result.won ? "border-primary-200 bg-primary-50" : "border-danger-100 bg-danger-50/30"
                  }`}
                >
                  <p className="text-small font-medium">
                    {result.won ? "Called it!" : "The market disagreed"}
                    <span className="ml-2 font-mono text-tiny text-default-500">
                      {result.from.toFixed(1)}% → {result.to.toFixed(1)}%
                    </span>
                  </p>
                  <Icon
                    icon={result.won ? "solar:medal-ribbons-star-bold-duotone" : "solar:target-bold-duotone"}
                    className={result.won ? "text-warning" : "text-default-400"}
                    width={20}
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex overflow-hidden rounded-full border-small border-default-200">
                  {(["home", "away"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      className={`px-3 py-1.5 text-tiny font-medium transition-colors ${
                        side === s ? "bg-default-100 text-foreground" : "text-default-400"
                      }`}
                    >
                      {s === "home" ? match.home : match.away}
                    </button>
                  ))}
                </div>
                <p className="font-mono text-small text-default-500">
                  now <span className="font-semibold" style={{ color: teamColor }}>{prob.toFixed(1)}%</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  color="primary"
                  radius="full"
                  startContent={<Icon icon="solar:arrow-up-bold" width={18} />}
                  onPress={() => lockPick("up")}
                >
                  Higher
                </Button>
                <Button
                  radius="full"
                  variant="bordered"
                  className="border-default-300"
                  startContent={<Icon icon="solar:arrow-down-bold" width={18} />}
                  onPress={() => lockPick("down")}
                >
                  Lower
                </Button>
              </div>
              <p className="text-center text-tiny text-default-400">
                Will {team}&apos;s win chance be higher or lower in 5 match minutes?
              </p>

              {stats.plays > 0 && (
                <Button
                  size="sm"
                  radius="full"
                  variant="light"
                  className="self-center text-default-400"
                  startContent={<Icon icon="solar:share-linear" width={14} />}
                  onPress={share}
                >
                  Share your record
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardBody>
    </Card>
  );
}
