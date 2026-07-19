"use client";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import MatchScreen from "@/components/MatchScreen";
import { useFavorites } from "@/lib/favorites";

/**
 * "Watch with me" landing - applies shared team follows from the link,
 * then opens the live (or replay) match with a together banner.
 */
function WatchInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const fixtureId = Number(params.id);
  const { favorites, toggle, ready } = useFavorites();
  const [banner, setBanner] = useState(true);
  const teamsParam = search.get("teams");
  const wantReplay = search.get("replay") === "1";

  useEffect(() => {
    if (!ready || !teamsParam) return;
    const teams = teamsParam.split(",").map((t) => t.trim()).filter(Boolean);
    for (const t of teams) {
      if (!favorites.includes(t)) toggle(t);
    }
  }, [ready, teamsParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
      router.replace("/matches");
    }
  }, [fixtureId, router]);

  if (!Number.isFinite(fixtureId) || fixtureId <= 0) return null;

  return (
    <div className="relative">
      {banner && (
        <div className="sticky top-0 z-40 border-b border-primary-200/50 bg-primary-50/95 px-4 py-2.5 backdrop-blur-md dark:border-primary-900/40 dark:bg-primary-950/90">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Chip size="sm" color="primary" variant="flat" className="shrink-0 font-semibold">
                Watch with me
              </Chip>
              <p className="truncate text-tiny text-default-600 dark:text-default-300">
                Same match, same heartbeat. Share this link with friends.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {wantReplay && (
                <Button
                  as={Link}
                  href={`/match/${fixtureId}`}
                  size="sm"
                  radius="full"
                  variant="flat"
                  color="secondary"
                  startContent={<Icon icon="solar:rewind-back-bold" width={14} />}
                >
                  Replay
                </Button>
              )}
              <Button size="sm" radius="full" variant="light" isIconOnly onPress={() => setBanner(false)}>
                <Icon icon="solar:close-circle-linear" width={18} />
              </Button>
            </div>
          </div>
        </div>
      )}
      <MatchScreen fixtureId={fixtureId} autoReplay={wantReplay} />
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl p-6">
          <Card shadow="sm">
            <CardBody className="p-6 text-center text-small text-default-400">Opening the match…</CardBody>
          </Card>
        </main>
      }
    >
      <WatchInner />
    </Suspense>
  );
}
