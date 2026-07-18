"use client";

import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import type { MatchEvent } from "@/lib/txline/types";

const KIND_META: Record<string, { icon: string; color: string }> = {
  goal: { icon: "solar:football-bold-duotone", color: "text-warning" },
  goal_disallowed: { icon: "solar:close-circle-bold-duotone", color: "text-danger" },
  var: { icon: "solar:videocamera-record-bold-duotone", color: "text-default-400" },
  card_red: { icon: "solar:card-bold-duotone", color: "text-danger" },
  card_yellow: { icon: "solar:card-bold-duotone", color: "text-warning" },
  corner: { icon: "solar:flag-bold-duotone", color: "text-default-400" },
  penalty: { icon: "solar:target-bold-duotone", color: "text-danger" },
  kickoff: { icon: "solar:play-circle-bold-duotone", color: "text-primary" },
  halftime: { icon: "solar:pause-circle-bold-duotone", color: "text-default-400" },
  fulltime: { icon: "solar:stop-circle-bold-duotone", color: "text-default-400" },
  shift: { icon: "solar:graph-up-bold-duotone", color: "text-secondary" },
  info: { icon: "solar:info-circle-bold-duotone", color: "text-default-400" },
};

export default function EventTicker({ events }: { events: MatchEvent[] }) {
  const recent = [...events].sort((a, b) => b.ts - a.ts).slice(0, 30);

  if (recent.length === 0) {
    return (
      <Card shadow="none" className="border-small border-dashed border-default-200">
        <CardBody className="items-center gap-2 py-8">
          <Icon icon="solar:soundwave-bold-duotone" className="text-default-300" width={30} />
          <p className="text-small text-default-400">Match moments will appear here as they happen</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {recent.map((e) => {
          const meta = KIND_META[e.kind] ?? KIND_META.info;
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Card shadow="sm" className="border-small border-default-200">
                <CardBody className="flex-row items-center gap-3 p-3">
                  <div className="flex items-center justify-center rounded-medium border border-default-100 bg-default-50 p-1.5">
                    <Icon icon={meta.icon} className={meta.color} width={20} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-small">{e.label}</p>
                    <p className="text-tiny text-default-400">
                      {e.minute !== undefined ? `${Math.floor(e.minute)}′` : new Date(e.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {e.delta !== undefined && (
                    <Chip size="sm" variant="flat" color={e.delta > 0 ? "primary" : "danger"} className="font-mono">
                      {e.delta > 0 ? "+" : ""}
                      {e.delta.toFixed(1)}pp
                    </Chip>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
