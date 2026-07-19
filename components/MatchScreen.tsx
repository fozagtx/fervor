"use client";

import { Button, Card, CardBody, CardHeader, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import ScoreHeader from "@/components/ScoreHeader";
import MarketSlip from "@/components/MarketSlip";
import WaveChart from "@/components/WaveChart";
import EventTicker from "@/components/EventTicker";
import GoalBlast from "@/components/GoalBlast";
import SoundToggle from "@/components/SoundToggle";
import PredictCard from "@/components/PredictCard";
import ProofBadge from "@/components/ProofBadge";
import RecapCard from "@/components/RecapCard";
import { PunditCaption, PunditToggle } from "@/components/PunditVoice";
import { shareWatch, embedPath } from "@/lib/share";
import { useMatchStream } from "@/lib/useMatchStream";
import type { MatchState } from "@/lib/txline/types";

const SPEEDS = [10, 30, 60];

export default function MatchScreen({
  fixtureId,
  autoReplay = false,
}: {
  fixtureId: number;
  autoReplay?: boolean;
}) {
  const [replay, setReplay] = useState(autoReplay);
  const [speed, setSpeed] = useState(30);
  const [pundit, setPundit] = useState(false);
  const { matches, connected, replayDone } = useMatchStream({ fixtureId, replay, speed });
  const streamMatch = matches.get(fixtureId);

  useEffect(() => {
    if (autoReplay) setReplay(true);
  }, [autoReplay]);

  // Finished matches: load recorded wave immediately so chart shows before recap/replay.
  const [history, setHistory] = useState<{ probs: MatchState["probs"]; events: MatchState["events"] } | null>(null);
  const streamFinished = /(ft|full|final|ended|finish)/.test(streamMatch?.gameState.toLowerCase() ?? "");
  useEffect(() => {
    if (replay || !streamFinished || !streamMatch) return;
    // Still hydrate if stream only has a thin buffer
    if (streamMatch.probs.length > 40) return;
    let stale = false;
    fetch(`/api/history/${fixtureId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => {
        if (!stale && h?.probs?.length > 5) setHistory(h);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [fixtureId, replay, streamFinished, streamMatch]);

  const match: MatchState | undefined =
    streamMatch && !replay && history && history.probs.length > (streamMatch.probs.length ?? 0)
      ? { ...streamMatch, probs: history.probs, events: history.events }
      : streamMatch;

  const g = match?.gameState.toLowerCase() ?? "";
  const finished = /(ft|full|final|ended|finish)/.test(g);
  const canReplay = finished || (!!match && match.probs.length === 0 && match.startTime < Date.now() - 2 * 3600000);
  const isLive = !!match && !finished && !replay && !/(sched|await)/.test(g) && match.probs.length > 0;

  // A goal you can feel: vibrate on new goals during live viewing or replay
  useEffect(() => {
    if (!match || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    const goals = match.events.filter((e) => e.kind === "goal");
    const last = goals[goals.length - 1];
    if (!last) return;
    const seenKey = `torq-buzz-${fixtureId}`;
    const seen = sessionStorage.getItem(seenKey);
    if (seen === last.id) return;
    sessionStorage.setItem(seenKey, last.id);
    if (seen !== null && (isLive || replay)) navigator.vibrate([60, 40, 120]);
  }, [match, match?.events.length, fixtureId, isLive, replay]);

  // The tab itself shows the live score
  useEffect(() => {
    if (!match) return;
    document.title = isLive
      ? `● LIVE ${match.scoreHome}–${match.scoreAway} · ${match.home} vs ${match.away} — Torq`
      : `${match.home} vs ${match.away} — Torq`;
    return () => {
      document.title = "Torq — the heartbeat of the World Cup";
    };
  }, [match, isLive, match?.scoreHome, match?.scoreAway]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <TopBar live={isLive} connected={connected} />

      {!match ? (
        <Card shadow="sm" className="border-small border-default-200">
          <CardBody className="gap-4 p-5">
            <Skeleton className="h-6 w-2/5 rounded-medium" />
            <Skeleton className="h-10 w-3/5 rounded-medium" />
            <Skeleton className="h-[200px] w-full rounded-medium" />
            {!connected && (
              <p className="text-center text-tiny text-default-400">Connecting to the live feed…</p>
            )}
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Button
              as={Link}
              href="/matches"
              size="sm"
              radius="full"
              variant="light"
              className="-translate-x-2 text-default-500"
              startContent={<Icon icon="solar:alt-arrow-left-linear" width={15} />}
            >
              All matches
            </Button>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                radius="full"
                variant="flat"
                color="primary"
                startContent={<Icon icon="solar:users-group-rounded-bold-duotone" width={15} />}
                onPress={() => match && shareWatch(match, { teams: [match.home, match.away] })}
                isDisabled={!match}
              >
                Watch with me
              </Button>
              <Button
                size="sm"
                radius="full"
                variant="bordered"
                className="hidden border-default-300 text-default-500 sm:flex"
                startContent={<Icon icon="solar:widget-add-linear" width={14} />}
                onPress={() =>
                  window.open(`/mini/${fixtureId}?p=1`, "torq-mini", "width=380,height=110,resizable=yes")
                }
              >
                Mini
              </Button>
              <Button
                size="sm"
                radius="full"
                variant="light"
                className="hidden text-default-400 sm:flex"
                startContent={<Icon icon="solar:code-bold" width={14} />}
                onPress={async () => {
                  const snippet = `<iframe src="${location.origin}${embedPath(fixtureId)}" width="420" height="280" frameborder="0" style="border:0;border-radius:12px"></iframe>`;
                  try {
                    await navigator.clipboard.writeText(snippet);
                  } catch {
                    // ignore
                  }
                }}
              >
                Embed
              </Button>
            </div>
          </div>

          <GoalBlast match={match} active={isLive || replay} />

          <ScoreHeader match={match} replay={replay} />

          {!replay && <MarketSlip match={match} />}

          {!replay && canReplay && (
            <Card shadow="sm" className="border-small border-default-200">
              <CardBody className="flex-row flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-medium border border-secondary-100 bg-secondary-50 p-2">
                    <Icon icon="solar:rewind-back-bold-duotone" className="text-secondary" width={20} />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-small font-semibold">Relive this match</p>
                    <p className="text-tiny text-default-400">
                      Replay the full market timeline, minute by minute
                    </p>
                  </div>
                </div>
                <Button
                  color="primary"
                  radius="full"
                  startContent={<Icon icon="solar:play-bold" width={18} />}
                  onPress={() => setReplay(true)}
                >
                  Replay
                </Button>
              </CardBody>
            </Card>
          )}

          {replay && (
            <Card shadow="sm" className="border-small border-secondary-100">
              <CardBody className="flex-row flex-wrap items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-2">
                  <Chip size="sm" variant="flat" color="secondary" className="font-mono">
                    {replayDone ? "REPLAY ENDED" : "REPLAYING"}
                  </Chip>
                  <div className="flex items-center gap-1">
                    {SPEEDS.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        radius="full"
                        variant={speed === s ? "solid" : "light"}
                        color={speed === s ? "secondary" : "default"}
                        className="min-w-12 font-mono"
                        onPress={() => setSpeed(s)}
                      >
                        {s}×
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {replayDone && (
                    <Button
                      size="sm"
                      radius="full"
                      variant="bordered"
                      startContent={<Icon icon="solar:refresh-linear" width={16} />}
                      onPress={() => {
                        setReplay(false);
                        setTimeout(() => setReplay(true), 50);
                      }}
                    >
                      Replay again
                    </Button>
                  )}
                  <Button
                    size="sm"
                    radius="full"
                    variant="light"
                    onPress={() => setReplay(false)}
                  >
                    Exit
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          <Card shadow="sm" className="border-small border-default-200">
            <CardHeader className="flex-col items-start gap-1 px-5 pb-0 pt-4">
              <div className="flex items-center gap-2">
                <Icon icon="solar:heart-bold-duotone" className="text-primary" width={18} />
                <p className="text-medium font-semibold">Win probability</p>
              </div>
              <p className="text-tiny text-default-400">
                What the betting world believes right now. It moves as the game does.
              </p>
            </CardHeader>
            <CardBody className="px-2 pb-3 pt-2 sm:px-4">
              <WaveChart
                probs={match.probs}
                events={match.events}
                home={match.home}
                away={match.away}
              />
            </CardBody>
          </Card>

          {(finished || replayDone) && match.probs.length > 5 && <RecapCard match={match} />}

          {(replay || !finished) && !replayDone && match.probs.length > 0 && (
            <PredictCard match={match} />
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:soundwave-bold-duotone" width={18} className="text-default-400" />
                <h2 className="text-small font-semibold uppercase tracking-wide text-default-500">
                  Match moments
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <SoundToggle />
                <PunditToggle enabled={pundit} onChange={setPundit} />
              </div>
            </div>
            <PunditCaption match={match} enabled={pundit} />
            <EventTicker events={match.events} />
          </section>

          <ProofBadge fixtureId={match.fixtureId} />
        </>
      )}
    </main>
  );
}
