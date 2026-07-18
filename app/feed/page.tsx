"use client";

import { Button, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Mascot from "@/components/Mascot";
import { flagOf } from "@/lib/flags";
import { COLORS } from "@/components/PulseChart";
import type { ProbPoint } from "@/lib/txline/types";

interface FeedMoment {
  id: string;
  fixtureId: number;
  home: string;
  away: string;
  kind: string;
  label: string;
  minute?: number;
  side?: "home" | "away";
  delta?: number;
  scoreHome: number;
  scoreAway: number;
  finalHome: number;
  finalAway: number;
  spark: ProbPoint[];
}

type Counts = Partial<Record<"fire" | "shock" | "ball", number>>;

const KIND_META: Record<string, { icon: string; chip: string; tint: string }> = {
  goal: { icon: "solar:football-bold-duotone", chip: "GOAL", tint: "from-warning-100/70 dark:from-warning-50/20" },
  goal_disallowed: { icon: "solar:close-circle-bold-duotone", chip: "DISALLOWED", tint: "from-danger-100/60 dark:from-danger-50/20" },
  card_red: { icon: "solar:card-bold-duotone", chip: "RED CARD", tint: "from-danger-100/60 dark:from-danger-50/20" },
  penalty: { icon: "solar:target-bold-duotone", chip: "PENALTY", tint: "from-danger-100/50 dark:from-danger-50/15" },
  shift: { icon: "solar:graph-up-bold-duotone", chip: "MARKET SHIFT", tint: "from-secondary-100/60 dark:from-secondary-50/20" },
  var: { icon: "solar:videocamera-record-bold-duotone", chip: "VAR", tint: "from-default-200/60 dark:from-default-100/30" },
};

const EMOJIS: Array<{ kind: "fire" | "shock" | "ball"; glyph: string }> = [
  { kind: "fire", glyph: "🔥" },
  { kind: "shock", glyph: "😱" },
  { kind: "ball", glyph: "⚽" },
];

export default function FeedPage() {
  const [moments, setMoments] = useState<FeedMoment[] | null>(null);
  const [reactions, setReactions] = useState<Record<string, Counts>>({});
  const [mine, setMine] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch("/api/feed")
      .then((r) => r.json())
      .then((d) => {
        setMoments(d.moments ?? []);
        setReactions(d.reactions ?? {});
      })
      .catch(() => setMoments([]));
    try {
      setMine(JSON.parse(localStorage.getItem("fervor-reactions") || "{}"));
    } catch {
      // fresh start
    }
  }, []);

  const react = (id: string, kind: "fire" | "shock" | "ball") => {
    if (mine[id]?.includes(kind)) return;
    const nextMine = { ...mine, [id]: [...(mine[id] ?? []), kind] };
    setMine(nextMine);
    try {
      localStorage.setItem("fervor-reactions", JSON.stringify(nextMine));
    } catch {
      // private browsing
    }
    setReactions((r) => ({
      ...r,
      [id]: { ...r[id], [kind]: (r[id]?.[kind] ?? 0) + 1 },
    }));
    fetch("/api/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind }),
    }).catch(() => {});
  };

  const share = async (m: FeedMoment) => {
    const text = `${flagOf(m.home)} ${m.home} ${m.scoreHome}–${m.scoreAway} ${m.away} ${flagOf(m.away)} · ${m.label} (${m.minute ?? "?"}′). Felt on Fervor ⚽📈`;
    try {
      if (navigator.share) await navigator.share({ text, url: `${location.origin}/match/${m.fixtureId}` });
      else await navigator.clipboard.writeText(`${text} ${location.origin}/match/${m.fixtureId}`);
    } catch {
      // dismissed
    }
  };

  return (
    <main className="h-dvh snap-y snap-mandatory overflow-y-scroll bg-background">
      <Button
        as={Link}
        href="/"
        isIconOnly
        size="sm"
        radius="full"
        variant="flat"
        aria-label="Close moments"
        className="fixed right-4 top-4 z-50 bg-default-100/80 backdrop-blur"
      >
        <Icon icon="solar:close-circle-linear" width={18} />
      </Button>

      {moments === null && (
        <section className="flex h-dvh snap-start flex-col items-center justify-center gap-4 px-8">
          <Mascot size={72} />
          <Skeleton className="h-40 w-full max-w-sm rounded-large" />
          <p className="text-tiny text-default-400">Loading the drama…</p>
        </section>
      )}

      {moments?.length === 0 && (
        <section className="flex h-dvh snap-start flex-col items-center justify-center gap-3 px-8 text-center">
          <Icon icon="solar:soundwave-bold-duotone" className="text-default-300" width={40} />
          <p className="text-medium font-semibold">No moments yet</p>
          <p className="text-small text-default-400">Come back once a match has been played.</p>
        </section>
      )}

      {moments?.map((m, i) => {
        const meta = KIND_META[m.kind] ?? KIND_META.var;
        const counts = reactions[m.id] ?? {};
        return (
          <section
            key={m.id}
            className={`relative flex h-dvh snap-start flex-col justify-between bg-gradient-to-b ${meta.tint} via-background to-background px-5 pb-8 pt-16`}
          >
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
              <div className="flex items-center justify-between">
                <Chip size="sm" variant="flat" color="primary" className="font-pixel">
                  <span className="flex items-center gap-1.5">
                    <Icon icon={meta.icon} width={14} />
                    {meta.chip}
                  </span>
                </Chip>
                {m.minute !== undefined && (
                  <Chip size="sm" variant="flat" className="font-mono text-default-500">
                    {Math.floor(m.minute)}′
                  </Chip>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-5xl">{flagOf(m.home)}</span>
                  <span className="text-small font-semibold">{m.home}</span>
                </div>
                <p className="font-mono text-5xl font-semibold tabular-nums">
                  {m.scoreHome}
                  <span className="px-1 text-default-300">–</span>
                  {m.scoreAway}
                </p>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-5xl">{flagOf(m.away)}</span>
                  <span className="text-small font-semibold">{m.away}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                {m.kind === "goal" && <Mascot size={40} celebrate />}
                <p className="text-center text-xl font-semibold leading-snug">{m.label}</p>
              </div>

              {m.spark.length > 3 && <Spark spark={m.spark} />}

              <div className="flex items-center justify-center gap-2">
                {EMOJIS.map(({ kind, glyph }) => {
                  const active = mine[m.id]?.includes(kind);
                  return (
                    <button
                      key={kind}
                      onClick={() => react(m.id, kind)}
                      className={`flex items-center gap-1.5 rounded-full border-small px-3.5 py-1.5 text-medium transition-transform active:scale-90 ${
                        active
                          ? "border-primary-300 bg-primary-50"
                          : "border-default-200 bg-content1"
                      }`}
                    >
                      <span>{glyph}</span>
                      {(counts[kind] ?? 0) > 0 && (
                        <span className="font-mono text-tiny text-default-500">{counts[kind]}</span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => share(m)}
                  className="flex items-center gap-1.5 rounded-full border-small border-default-200 bg-content1 px-3.5 py-1.5 transition-transform active:scale-90"
                  aria-label="Share this moment"
                >
                  <Icon icon="solar:share-linear" width={17} className="text-default-500" />
                </button>
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-md items-center justify-between">
              <p className="text-tiny text-default-400">
                Final: {m.home} {m.finalHome}–{m.finalAway} {m.away}
              </p>
              <Button
                as={Link}
                href={`/match/${m.fixtureId}`}
                size="sm"
                radius="full"
                variant="bordered"
                className="border-default-300"
                startContent={<Icon icon="solar:rewind-back-bold" width={15} />}
              >
                Relive it
              </Button>
            </div>

            {i === 0 && (
              <div className="pointer-events-none absolute bottom-20 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-default-400">
                <Icon icon="solar:alt-arrow-up-linear" width={18} className="animate-bounce" />
                <span className="font-pixel text-tiny">SWIPE FOR MORE DRAMA</span>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}

function Spark({ spark }: { spark: ProbPoint[] }) {
  const W = 320;
  const H = 70;
  const t0 = spark[0].ts;
  const t1 = spark[spark.length - 1].ts;
  const span = Math.max(1, t1 - t0);
  const x = (ts: number) => ((ts - t0) / span) * W;
  const y = (p: number) => H - (p / 100) * H;
  const line = (get: (p: ProbPoint) => number) =>
    spark.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.ts).toFixed(1)} ${y(get(p)).toFixed(1)}`).join(" ");
  return (
    <div className="mx-auto w-full max-w-xs">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <path d={line((p) => p.home)} fill="none" stroke={COLORS.home} strokeWidth="2.5" strokeLinecap="round" />
        <path d={line((p) => p.away)} fill="none" stroke={COLORS.away} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={W / 2} x2={W / 2} y1="0" y2={H} stroke="var(--chart-grid)" strokeDasharray="3 4" />
      </svg>
      <p className="pt-1 text-center text-tiny text-default-400">the market, six minutes either side</p>
    </div>
  );
}
