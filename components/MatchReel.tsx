"use client";

import { Button, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { dramaScore } from "@/lib/drama";
import { useCountdown, useFavorites } from "@/lib/favorites";
import { flagOf } from "@/lib/flags";
import { shareWatch } from "@/lib/share";
import { useMatchStream } from "@/lib/useMatchStream";
import type { MatchState } from "@/lib/txline/types";
import DramaMeter from "./DramaMeter";
import Logo from "./Logo";
import MarketSlip from "./MarketSlip";
import MuteButton from "./MuteButton";
import ThemeToggle from "./ThemeToggle";
import WaveChart from "./WaveChart";

function bucket(m: MatchState): "live" | "upcoming" | "finished" {
  const g = m.gameState.toLowerCase();
  if (/(ft|full|final|ended|finish)/.test(g)) return "finished";
  if (/(sched|not|pre|await)/.test(g)) return "upcoming";
  return "live";
}

function sortReel(matches: MatchState[], favorites: string[]) {
  const score = (m: MatchState) => {
    const fav =
      (favorites.includes(m.home) ? 2 : 0) + (favorites.includes(m.away) ? 2 : 0);
    const b = bucket(m);
    const tier = b === "live" ? 300 : b === "upcoming" ? 200 : 100;
    return tier + fav;
  };
  return [...matches].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    if (bucket(a) === "upcoming") return a.startTime - b.startTime;
    return b.startTime - a.startTime;
  });
}

/** TikTok feed × SportyBet 1X2 slip — white stage, one market per swipe. */
export default function MatchReel() {
  const { matches, connected } = useMatchStream();
  const { favorites, toggle } = useFavorites();
  const reel = useMemo(
    () => sortReel([...matches.values()], favorites),
    [matches, favorites]
  );

  return (
    <main className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-y-contain bg-white [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-3 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-2.5 py-1.5 shadow-sm"
        >
          <Logo size={26} />
          <span className="text-small font-semibold text-zinc-900">Torq</span>
          <span className="hidden rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-amber-800 sm:inline">
            FOMO
          </span>
        </Link>
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white/95 p-1 shadow-sm">
          <MuteButton />
          <ThemeToggle />
          <Button
            as={Link}
            href="/feed"
            size="sm"
            radius="full"
            variant="light"
            className="min-w-0 px-2 font-pixel text-tiny text-zinc-700"
          >
            Moments
          </Button>
        </div>
      </header>

      {!connected && reel.length === 0 && (
        <section className="flex h-dvh w-full snap-start snap-always flex-col items-center justify-center gap-4 bg-white px-6">
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-28 w-full max-w-sm rounded-2xl" />
          <Skeleton className="h-36 w-full max-w-sm rounded-2xl" />
          <p className="text-tiny text-zinc-400">Loading markets…</p>
        </section>
      )}

      {connected && reel.length === 0 && (
        <section className="flex h-dvh w-full snap-start snap-always flex-col items-center justify-center gap-3 bg-white px-8 text-center">
          <Icon icon="solar:football-bold-duotone" className="text-zinc-300" width={40} />
          <p className="text-medium font-semibold text-zinc-900">No markets yet</p>
          <p className="text-small text-zinc-500">Come back when kick-off is close.</p>
        </section>
      )}

      {reel.map((m, i) => (
        <ReelSlide
          key={m.fixtureId}
          match={m}
          favorites={favorites}
          onToggleFavorite={toggle}
          showHint={i === 0}
          index={i}
          total={reel.length}
        />
      ))}
    </main>
  );
}

function ReelSlide({
  match,
  favorites,
  onToggleFavorite,
  showHint,
  index,
  total,
}: {
  match: MatchState;
  favorites: string[];
  onToggleFavorite: (team: string) => void;
  showHint: boolean;
  index: number;
  total: number;
}) {
  const router = useRouter();
  const live = bucket(match) === "live";
  const finished = bucket(match) === "finished";
  const countdown = useCountdown(match.startTime);
  const href = finished ? `/match/${match.fixtureId}?replay=1` : `/match/${match.fixtureId}`;
  const starred = favorites.includes(match.home) || favorites.includes(match.away);

  return (
    <section className="relative flex h-dvh w-full snap-start snap-always flex-col bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[4.5rem]">
      <div className="mx-auto flex h-full w-full max-w-lg flex-col pr-12">
        <div className="mb-2 flex items-center justify-between gap-2">
          <StatusChip live={live} finished={finished} match={match} countdown={countdown} />
          <div className="flex items-center gap-2">
            {live && <DramaMeter score={dramaScore(match)} compact />}
            <span className="font-mono text-[10px] text-zinc-400">
              {index + 1}/{total}
            </span>
          </div>
        </div>

        {/* Scoreboard */}
        <button
          type="button"
          onClick={() => router.push(href)}
          className="mb-3 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-left active:scale-[0.99]"
        >
          <div className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-5xl leading-none">{flagOf(match.home)}</span>
            <span className="w-full truncate text-center text-small font-semibold text-zinc-900">
              {match.home}
            </span>
          </div>
          <div className="flex flex-col items-center px-1">
            {live || finished ? (
              <p className="font-mono text-5xl font-bold tabular-nums leading-none text-zinc-900">
                {match.scoreHome}
                <span className="px-1 text-zinc-300">–</span>
                {match.scoreAway}
              </p>
            ) : (
              <p className="text-3xl font-medium text-zinc-400">vs</p>
            )}
            {live && match.minute != null && (
              <p className="mt-1 font-mono text-tiny font-semibold text-emerald-600">
                {Math.floor(match.minute)}′
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-5xl leading-none">{flagOf(match.away)}</span>
            <span className="w-full truncate text-center text-small font-semibold text-zinc-900">
              {match.away}
            </span>
          </div>
        </button>

        {/* Hero: SportyBet-style 1X2 slip */}
        <div className="mb-2 shrink-0">
          <MarketSlip match={match} />
        </div>

        {/* Compact wave proof */}
        <div className="mb-2 min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80 px-1 pt-1">
          {match.probs.length > 2 ? (
            <div className="h-full min-h-[100px] [&_svg]:h-full [&_svg]:max-h-[160px] [&_svg]:w-full">
              <WaveChart probs={match.probs} events={match.events} home={match.home} away={match.away} />
            </div>
          ) : (
            <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-1 px-4 text-center">
              <Icon icon="solar:soundwave-bold-duotone" className="text-zinc-300" width={26} />
              <p className="text-tiny text-zinc-400">
                {finished ? "Open replay for the full wave" : "Live prices open nearer kick-off"}
              </p>
            </div>
          )}
        </div>

        <Button
          color="primary"
          radius="full"
          className="h-11 shrink-0 font-semibold"
          startContent={<Icon icon={finished ? "solar:play-bold" : "solar:eye-bold"} width={18} />}
          onPress={() => router.push(href)}
        >
          {finished ? "Replay full match" : live ? "Open live room" : "Open match"}
        </Button>
      </div>

      {/* TikTok side rail */}
      <aside className="absolute bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] right-2 z-20 flex flex-col items-center gap-3">
        <RailBtn
          label="Star"
          onPress={() => onToggleFavorite(match.home)}
          icon={starred ? "solar:star-bold" : "solar:star-linear"}
          accent={starred}
        />
        <RailBtn
          label="Share"
          onPress={() => void shareWatch(match)}
          icon="solar:share-bold"
        />
        <RailBtn
          label={finished ? "Replay" : "Open"}
          onPress={() => router.push(href)}
          icon={finished ? "solar:play-bold" : "solar:arrow-right-up-bold"}
        />
      </aside>

      {showHint && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5 text-zinc-400">
          <Icon icon="solar:alt-arrow-up-linear" width={18} className="animate-bounce" />
          <span className="font-pixel text-[10px] tracking-wide">SWIPE NEXT MARKET</span>
        </div>
      )}
    </section>
  );
}

function RailBtn({
  label,
  icon,
  onPress,
  accent,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex flex-col items-center gap-0.5 active:scale-90"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm">
        <Icon icon={icon} width={20} className={accent ? "text-amber-500" : "text-zinc-800"} />
      </span>
      <span className="text-[9px] font-semibold text-zinc-500">{label}</span>
    </button>
  );
}

function StatusChip({
  live,
  finished,
  match,
  countdown,
}: {
  live: boolean;
  finished: boolean;
  match: MatchState;
  countdown: string | null;
}) {
  if (live) {
    return (
      <Chip
        size="sm"
        variant="flat"
        color="primary"
        className="font-semibold"
        startContent={<span className="live-dot ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
      >
        LIVE MARKET
      </Chip>
    );
  }
  if (finished) {
    return (
      <Chip size="sm" variant="flat" color="secondary" className="font-semibold">
        FT · REPLAY
      </Chip>
    );
  }
  if (countdown) {
    return (
      <Chip size="sm" variant="flat" className="bg-zinc-100 font-mono font-semibold text-emerald-700">
        KO {countdown}
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="flat" className="bg-zinc-100 font-mono text-zinc-600">
      {new Date(match.startTime).toLocaleString(undefined, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </Chip>
  );
}
