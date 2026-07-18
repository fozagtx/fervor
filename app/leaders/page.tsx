"use client";

import { Card, CardBody, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import FeedFab from "@/components/FeedFab";
import Mascot from "@/components/Mascot";
import TopBar from "@/components/TopBar";
import { playerId, playerName } from "@/lib/player";

interface Entry {
  id: string;
  name: string;
  points: number;
  best: number;
  wins: number;
  plays: number;
}

export default function LeadersPage() {
  const [top, setTop] = useState<Entry[] | null>(null);
  const [me, setMe] = useState<string>("");

  useEffect(() => {
    setMe(playerId());
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setTop(d.top ?? []))
      .catch(() => setTop([]));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <FeedFab />
      <TopBar />

      <div className="flex items-center gap-3 px-1">
        <Mascot size={44} />
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">Top callers</h1>
          <p className="text-small text-default-400">
            The fans beating the bookmakers. Play any live match or replay to enter.
          </p>
        </div>
      </div>

      {top === null && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-large" />
          ))}
        </div>
      )}

      {top?.length === 0 && (
        <Card shadow="none" className="border-small border-dashed border-default-200">
          <CardBody className="items-center gap-2 py-10">
            <Icon icon="solar:cup-star-bold-duotone" className="text-default-300" width={34} />
            <p className="text-small text-default-400">
              Nobody on the board yet. Win a call and claim the top spot.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {top?.map((e, i) => {
          const mine = e.id === me;
          return (
            <Card
              key={e.id}
              shadow="sm"
              className={`border-small ${mine ? "border-primary-300" : "border-default-200"}`}
            >
              <CardBody className="flex-row items-center gap-3 px-4 py-3">
                <span
                  className={`w-8 shrink-0 text-center font-mono text-medium font-bold ${
                    i === 0 ? "text-warning" : i < 3 ? "text-default-600" : "text-default-400"
                  }`}
                >
                  {i === 0 ? "🏆" : i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-small font-semibold">
                    {e.name}
                    {mine && <span className="ml-2 text-tiny text-primary">you</span>}
                  </p>
                  <p className="text-tiny text-default-400">
                    {e.wins}/{e.plays} calls · best streak {e.best}
                  </p>
                </div>
                <Chip size="sm" variant="flat" color="warning" className="font-mono font-semibold">
                  {e.points.toLocaleString()} pts
                </Chip>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-tiny text-default-400">
        Your record is saved as {playerName()} · connect a wallet to keep it forever
      </p>
    </main>
  );
}
