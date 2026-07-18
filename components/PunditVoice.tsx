"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { punditLine, speak } from "@/lib/pundit";
import type { MatchState } from "@/lib/txline/types";

export function PunditToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Button
      size="sm"
      radius="full"
      variant={enabled ? "flat" : "bordered"}
      color={enabled ? "primary" : "default"}
      className={enabled ? "" : "border-default-300 text-default-500"}
      startContent={
        <Icon
          icon={enabled ? "solar:volume-loud-bold" : "solar:volume-cross-bold"}
          width={15}
        />
      }
      onPress={() => onChange(!enabled)}
    >
      Pundit voice
    </Button>
  );
}

export function PunditCaption({
  match,
  enabled,
}: {
  match: MatchState;
  enabled: boolean;
}) {
  const [caption, setCaption] = useState<string | null>(null);
  const spokenIds = useRef(new Set<string>());
  const primed = useRef(false);

  useEffect(() => {
    // Don't narrate history: mark everything before enabling as already spoken
    if (!primed.current) {
      for (const e of match.events) spokenIds.current.add(e.id);
      primed.current = true;
      return;
    }
    if (!enabled) {
      for (const e of match.events) spokenIds.current.add(e.id);
      return;
    }
    const fresh = match.events.filter((e) => !spokenIds.current.has(e.id));
    for (const e of fresh) {
      spokenIds.current.add(e.id);
      const line = punditLine(e, match);
      if (line) {
        setCaption(line);
        speak(line);
      }
    }
  }, [match, match.events, enabled]);

  return (
    <AnimatePresence>
      {enabled && caption && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <Card shadow="sm" className="border-small border-primary-200 bg-primary-50/40">
            <CardBody className="flex-row items-start gap-3 p-3">
              <div className="flex items-center justify-center rounded-medium border border-primary-100 bg-primary-50 p-1.5">
                <Icon icon="solar:microphone-3-bold-duotone" className="text-primary" width={18} />
              </div>
              <p className="text-small leading-snug">{caption}</p>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
