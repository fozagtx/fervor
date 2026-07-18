"use client";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import FeedFab from "@/components/FeedFab";
import InstallButton from "@/components/InstallButton";
import Mascot from "@/components/Mascot";
import TopBar from "@/components/TopBar";
import MatchCard from "@/components/MatchCard";
import { favScore, useFavorites } from "@/lib/favorites";
import { useMatchStream } from "@/lib/useMatchStream";
import type { MatchState } from "@/lib/txline/types";

function isLive(m: MatchState): boolean {
  const g = m.gameState.toLowerCase();
  return !/(sched|await|ft|full|final|ended|finish)/.test(g) && m.probs.length > 0;
}

export default function Landing() {
  const { matches, connected } = useMatchStream();
  const { favorites, toggle } = useFavorites();
  const all = [...matches.values()];
  const live = all.filter(isLive);
  const upNext = all
    .filter((m) => !isLive(m) && /sched/.test(m.gameState.toLowerCase()))
    .sort((a, b) => favScore(b, favorites) - favScore(a, favorites) || a.startTime - b.startTime)
    .slice(0, 2);
  const featured = live.length > 0 ? live.slice(0, 2) : upNext;
  const recent = all
    .filter((m) => /(ft|full|final|ended|finish)/.test(m.gameState.toLowerCase()))
    .sort((a, b) => b.startTime - a.startTime)[0];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <FeedFab />
      <TopBar live={live.length > 0} connected={connected} />

      <section className="flex flex-col gap-4 px-1 pt-4 sm:pt-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Mascot size={44} />
            <Chip size="sm" variant="flat" color="primary" className="w-fit">
              World Cup 2026
            </Chip>
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Every match has a heartbeat.
          </h1>
          <p className="max-w-lg text-medium text-default-500">
            See the World Cup the way the bookmakers do: live win chances that
            move with every goal, red card and momentum swing. Feel the game.
            Call the swings. Relive the drama.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            as={Link}
            href="/matches"
            color="primary"
            radius="full"
            size="lg"
            startContent={<Icon icon="solar:play-bold" width={19} />}
          >
            Open the live lobby
          </Button>
          {recent && (
            <Button
              as={Link}
              href={`/match/${recent.fixtureId}`}
              radius="full"
              size="lg"
              variant="bordered"
              className="border-default-300"
              startContent={<Icon icon="solar:rewind-back-bold" width={18} />}
            >
              Replay {recent.home} vs {recent.away}
            </Button>
          )}
          <InstallButton />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Icon
              icon={live.length > 0 ? "solar:play-stream-bold-duotone" : "solar:calendar-bold-duotone"}
              width={18}
              className={live.length > 0 ? "text-primary" : "text-default-400"}
            />
            <h2 className="text-small font-semibold uppercase tracking-wide text-default-500">
              {live.length > 0 ? "Live right now" : "Up next"}
            </h2>
          </div>
          {featured.map((m) => (
            <MatchCard key={m.fixtureId} match={m} favorites={favorites} onToggleFavorite={toggle} />
          ))}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <FeatureCard
          icon="solar:heart-pulse-bold-duotone"
          color="text-primary"
          wrapper="border-primary-100 bg-primary-50"
          title="The wave"
          text="Win chances update every few seconds. When a goal hits, you watch the whole market flinch."
        />
        <FeatureCard
          icon="solar:cup-star-bold-duotone"
          color="text-warning"
          wrapper="border-warning-100 bg-warning-50"
          title="Pulse calls"
          text="Higher or lower in five minutes? Outsmart the bookies, build a streak. Free, no sign-up."
        />
        <FeatureCard
          icon="solar:rewind-back-bold-duotone"
          color="text-secondary"
          wrapper="border-secondary-100 bg-secondary-50"
          title="Relive the drama"
          text="Any finished match replays like it is live. Watch the semi-final swing at 60x speed."
        />
      </section>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-2 text-center text-tiny text-default-400">
        <span>Free to play</span>
        <span>·</span>
        <span>No sign-up</span>
        <span>·</span>
        <span>Every score checkable on Solana</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Icon icon="solar:bolt-linear" width={12} />
          Powered by TxLINE
        </span>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  color,
  wrapper,
  title,
  text,
}: {
  icon: string;
  color: string;
  wrapper: string;
  title: string;
  text: string;
}) {
  return (
    <Card shadow="sm" className="border-small border-default-200">
      <CardBody className="flex h-full flex-row items-start gap-3 p-4 sm:flex-col">
        <div className={`flex items-center justify-center rounded-medium border p-2 ${wrapper}`}>
          <Icon icon={icon} className={color} width={24} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-medium font-semibold">{title}</p>
          <p className="text-small text-default-500">{text}</p>
        </div>
      </CardBody>
    </Card>
  );
}
