"use client";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import type { MatchState } from "@/lib/txline/types";
import { playerId } from "@/lib/player";
import Flag from "./Flag";
import { COLORS } from "./WaveChart";

type Side = "home" | "draw" | "away";

interface Tallies {
  home: number;
  draw: number;
  away: number;
  total: number;
}

function pct(n: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

/** FOMO pick: who wins — crowd split vs market favorite. No money. */
export default function WhoWins({
  match,
  compact = false,
}: {
  match: MatchState;
  compact?: boolean;
}) {
  const [tallies, setTallies] = useState<Tallies>({ home: 0, draw: 0, away: 0, total: 0 });
  const [yours, setYours] = useState<Side | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = match.probs[match.probs.length - 1];
  const finished = /(ft|full|final|ended|finish)/i.test(match.gameState);

  const load = useCallback(() => {
    fetch(`/api/who-wins?fixture=${match.fixtureId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTallies({ home: d.home, draw: d.draw, away: d.away, total: d.total });
      })
      .catch(() => {});
  }, [match.fixtureId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    try {
      const saved = localStorage.getItem(`torq-who-${match.fixtureId}`) as Side | null;
      if (saved === "home" || saved === "draw" || saved === "away") setYours(saved);
    } catch {
      // ignore
    }
    return () => clearInterval(t);
  }, [load, match.fixtureId]);

  const vote = async (side: Side) => {
    if (finished || busy) return;
    setBusy(true);
    setYours(side);
    try {
      localStorage.setItem(`torq-who-${match.fixtureId}`, side);
    } catch {
      // ignore
    }
    try {
      const res = await fetch("/api/who-wins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: match.fixtureId, side, player: playerId() }),
      });
      const d = await res.json();
      if (res.ok) {
        setTallies({ home: d.home, draw: d.draw, away: d.away, total: d.total });
      }
    } catch {
      // optimistic local only
    } finally {
      setBusy(false);
    }
  };

  const marketFav: Side | null = latest
    ? latest.home >= latest.away && latest.home >= latest.draw
      ? "home"
      : latest.away >= latest.home && latest.away >= latest.draw
        ? "away"
        : "draw"
    : null;

  const crowdFav: Side | null =
    tallies.total > 0
      ? tallies.home >= tallies.draw && tallies.home >= tallies.away
        ? "home"
        : tallies.away >= tallies.home && tallies.away >= tallies.draw
          ? "away"
          : "draw"
      : null;

  const label = (s: Side) =>
    s === "home" ? match.home : s === "away" ? match.away : "Draw";

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
            <Icon icon="solar:fire-bold" width={12} />
            Who wins?
          </span>
          {tallies.total > 0 && (
            <span className="font-mono text-[10px] text-default-400">{tallies.total} locked in</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(["home", "draw", "away"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              disabled={finished || busy}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                vote(s);
              }}
              className={`rounded-medium border px-1 py-1.5 text-center transition-colors ${
                yours === s
                  ? "border-warning-300 bg-warning-50 dark:bg-warning-950/40"
                  : "border-default-200 hover:border-default-400"
              }`}
            >
              <p className="flex items-center justify-center gap-0.5 truncate text-[10px] font-semibold leading-tight">
                {s === "draw" ? "Draw" : <Flag team={label(s)} size="xs" />}
              </p>
              <p className="font-mono text-[11px] font-bold tabular-nums">
                {pct(tallies[s], tallies.total)}%
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card shadow="sm" className="border-small border-warning-200/50">
      <CardBody className="gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon icon="solar:fire-bold-duotone" className="text-warning" width={18} />
            <div>
              <p className="text-small font-semibold">Who wins?</p>
              <p className="text-tiny text-default-400">
                Lock your call. See where the room is leaning. No money.
              </p>
            </div>
          </div>
          {tallies.total > 0 ? (
            <Chip size="sm" variant="flat" color="warning" className="font-mono">
              {tallies.total} fans in
            </Chip>
          ) : (
            <Chip size="sm" variant="flat" className="text-default-400">
              Be first
            </Chip>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { side: "home" as Side, name: match.home, color: COLORS.home },
              { side: "draw" as Side, name: "Draw", color: COLORS.draw },
              { side: "away" as Side, name: match.away, color: COLORS.away },
            ] as const
          ).map(({ side, name, color }) => {
            const share = pct(tallies[side], tallies.total);
            return (
              <Button
                key={side}
                radius="lg"
                variant={yours === side ? "solid" : "bordered"}
                color={yours === side ? "warning" : "default"}
                className="h-auto min-h-16 flex-col gap-0.5 py-2"
                isDisabled={finished || busy}
                onPress={() => vote(side)}
              >
                <span className="flex items-center justify-center leading-none">
                  {side === "draw" ? "🤝" : <Flag team={name} size="sm" />}
                </span>
                <span className="max-w-full truncate text-tiny font-semibold">{name}</span>
                <span className="font-mono text-medium font-bold tabular-nums" style={{ color: yours === side ? undefined : color }}>
                  {share}%
                </span>
              </Button>
            );
          })}
        </div>

        {/* Crowd bar */}
        <div className="flex h-2 overflow-hidden rounded-full bg-default-100">
          <div
            className="transition-all duration-500"
            style={{ width: `${pct(tallies.home, tallies.total)}%`, background: COLORS.home }}
          />
          <div
            className="transition-all duration-500"
            style={{ width: `${pct(tallies.draw, tallies.total)}%`, background: COLORS.draw, opacity: 0.7 }}
          />
          <div
            className="transition-all duration-500"
            style={{ width: `${pct(tallies.away, tallies.total)}%`, background: COLORS.away }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-tiny text-default-500">
          <span>
            {crowdFav && tallies.total >= 3 ? (
              <>
                Crowd leans <span className="font-semibold text-foreground">{label(crowdFav)}</span>
              </>
            ) : (
              "Cast a call — create the FOMO"
            )}
          </span>
          {marketFav && latest && (
            <span className="font-mono">
              Market: {label(marketFav)} {marketFav === "home" ? latest.home.toFixed(0) : marketFav === "away" ? latest.away.toFixed(0) : latest.draw.toFixed(0)}%
            </span>
          )}
        </div>

        {yours && crowdFav && yours !== crowdFav && tallies.total >= 5 && (
          <p className="rounded-medium bg-warning-50 px-3 py-2 text-tiny text-warning-700 dark:bg-warning-950/50 dark:text-warning-300">
            You&apos;re fading the room — {pct(tallies[crowdFav], tallies.total)}% are on {label(crowdFav)}.
          </p>
        )}

        {finished && yours && (
          <p className="text-center text-tiny text-default-400">
            Poll closed · you locked {label(yours)}
            {match.scoreHome > match.scoreAway && yours === "home" && " · called it"}
            {match.scoreAway > match.scoreHome && yours === "away" && " · called it"}
            {match.scoreHome === match.scoreAway && yours === "draw" && " · called it"}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
