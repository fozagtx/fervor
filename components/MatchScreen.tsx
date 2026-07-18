"use client";

import { Button, Card, CardBody, CardHeader, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";
import TopBar from "@/components/TopBar";
import ScoreHeader from "@/components/ScoreHeader";
import PulseChart from "@/components/PulseChart";
import EventTicker from "@/components/EventTicker";
import PredictCard from "@/components/PredictCard";
import ProofBadge from "@/components/ProofBadge";
import RecapCard from "@/components/RecapCard";
import { PunditCaption, PunditToggle } from "@/components/PunditVoice";
import { useMatchStream } from "@/lib/useMatchStream";

const SPEEDS = [10, 30, 60];

export default function MatchScreen({ fixtureId }: { fixtureId: number }) {
  const [replay, setReplay] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [pundit, setPundit] = useState(false);
  const { matches, connected, replayDone } = useMatchStream({ fixtureId, replay, speed });
  const match = matches.get(fixtureId);

  const g = match?.gameState.toLowerCase() ?? "";
  const finished = /(ft|full|final|ended|finish)/.test(g);
  const canReplay = finished || (!!match && match.probs.length === 0 && match.startTime < Date.now() - 2 * 3600000);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <TopBar live={!!match && match.probs.length > 0 && !finished && !replay} connected={connected} />

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
          <ScoreHeader match={match} replay={replay} />

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
                <Icon icon="solar:heart-pulse-bold-duotone" className="text-primary" width={18} />
                <p className="text-medium font-semibold">Win probability</p>
              </div>
              <p className="text-tiny text-default-400">
                What the betting world believes right now. It moves as the game does.
              </p>
            </CardHeader>
            <CardBody className="px-2 pb-3 pt-2 sm:px-4">
              <PulseChart
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
              <PunditToggle enabled={pundit} onChange={setPundit} />
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
