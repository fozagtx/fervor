"use client";

import { Card, CardBody, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import TopBar from "@/components/TopBar";
import MatchCard from "@/components/MatchCard";
import { useMatchStream } from "@/lib/useMatchStream";
import type { MatchState } from "@/lib/txline/types";

function bucket(m: MatchState): "live" | "upcoming" | "finished" {
  const g = m.gameState.toLowerCase();
  if (/(ft|full|final|ended|finish)/.test(g)) return "finished";
  if (/(sched|not|pre)/.test(g) && m.probs.length === 0) return "upcoming";
  if (/(sched|not|pre)/.test(g)) return "upcoming";
  return "live";
}

export default function Home() {
  const { matches, connected } = useMatchStream();
  const all = [...matches.values()];
  const live = all.filter((m) => bucket(m) === "live");
  const upcoming = all
    .filter((m) => bucket(m) === "upcoming")
    .sort((a, b) => a.startTime - b.startTime);
  const finished = all
    .filter((m) => bucket(m) === "finished")
    .sort((a, b) => b.startTime - a.startTime);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <TopBar live={live.length > 0} />

      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Every match has a heartbeat.
        </h1>
        <p className="text-small text-default-400">
          Live win probability from real betting-market consensus — watch it move as the game does.
        </p>
      </div>

      {!connected && all.length === 0 && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm" className="border-small border-default-200">
              <CardBody className="gap-3 p-4">
                <Skeleton className="h-5 w-3/5 rounded-medium" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {live.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle icon="solar:play-stream-bold-duotone" title="Live now" accent />
          {live.map((m) => (
            <MatchCard key={m.fixtureId} match={m} />
          ))}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle icon="solar:calendar-bold-duotone" title="Upcoming" />
          {upcoming.slice(0, 8).map((m) => (
            <MatchCard key={m.fixtureId} match={m} />
          ))}
        </section>
      )}

      {finished.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle icon="solar:flag-2-bold-duotone" title="Recent — tap to replay" />
          {finished.slice(0, 10).map((m) => (
            <MatchCard key={m.fixtureId} match={m} />
          ))}
        </section>
      )}

      {connected && all.length === 0 && (
        <Card shadow="none" className="border-small border-dashed border-default-200">
          <CardBody className="items-center gap-2 py-10">
            <Icon icon="solar:football-bold-duotone" className="text-default-300" width={34} />
            <p className="text-small text-default-400">No fixtures available right now</p>
          </CardBody>
        </Card>
      )}
    </main>
  );
}

function SectionTitle({ icon, title, accent }: { icon: string; title: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon icon={icon} width={18} className={accent ? "text-primary" : "text-default-400"} />
      <h2 className="text-small font-semibold uppercase tracking-wide text-default-500">{title}</h2>
    </div>
  );
}
