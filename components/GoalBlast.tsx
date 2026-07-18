"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Mascot from "@/components/Mascot";
import { flagOf } from "@/lib/flags";
import type { MatchState } from "@/lib/txline/types";
import { COLORS } from "./WaveChart";

import { playSound as play } from "@/lib/sound";

interface Blast {
  key: number;
  team: string;
  side: "home" | "away";
  score: string;
}

/**
 * The goal moment: crowd roar + fanfare, confetti in the scoring team's
 * color, a giant pixel GOOOAL banner and Beat kicking. Whistles mark
 * kick-off, half-time and full-time.
 */
export default function GoalBlast({
  match,
  active,
}: {
  match: MatchState;
  active: boolean;
}) {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [blast, setBlast] = useState<Blast | null>(null);

  useEffect(() => {
    if (!primed.current) {
      for (const e of match.events) seen.current.add(e.id);
      primed.current = true;
      return;
    }
    for (const e of match.events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      if (!active) continue;
      if (e.kind === "goal") {
        const team = e.side === "away" ? match.away : match.home;
        if (typeof document !== "undefined" && document.hidden &&
            typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification(`GOAL! ${team}`, {
              body: `${match.home} ${match.scoreHome}–${match.scoreAway} ${match.away}`,
              icon: "/icon-192.png",
            });
          } catch {}
        }
        play("/crowd.wav", 0.9);
        setTimeout(() => play("/goal.wav", 0.5), 250);
        setBlast({
          key: Date.now(),
          team,
          side: e.side ?? "home",
          score: `${match.scoreHome}–${match.scoreAway}`,
        });
        setTimeout(() => setBlast(null), 2600);
      } else if (e.kind === "kickoff" || e.kind === "halftime" || e.kind === "fulltime") {
        play("/whistle.wav", 0.6);
      }
    }
  }, [match, match.events.length, active]);

  const color = blast?.side === "away" ? COLORS.away : COLORS.home;

  return (
    <AnimatePresence>
      {blast && (
        <motion.div
          key={blast.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* confetti */}
          {Array.from({ length: 36 }).map((_, i) => {
            const left = (i * 61) % 100;
            const delay = (i % 9) * 0.06;
            const c = i % 3 === 0 ? "#F5A524" : i % 3 === 1 ? color : "#FFFFFF";
            const size = 6 + (i % 4) * 3;
            return (
              <span
                key={i}
                className="absolute top-[-4%] block"
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size * 1.6,
                  background: c,
                  animation: `torq-confetti 1.9s ${delay}s cubic-bezier(0.3,0.6,0.6,1) forwards`,
                  transform: `rotate(${(i * 47) % 360}deg)`,
                }}
              />
            );
          })}

          <motion.div
            initial={{ scale: 0.5, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="flex flex-col items-center gap-2 rounded-large bg-background/90 px-8 py-6 shadow-xl backdrop-blur"
          >
            <Mascot size={64} celebrate />
            <p className="font-pixel text-3xl" style={{ color }}>
              GOOOAL!
            </p>
            <p className="text-medium font-semibold">
              {flagOf(blast.team)} {blast.team} · <span className="font-mono">{blast.score}</span>
            </p>
          </motion.div>

          <style>{`
            @keyframes torq-confetti {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(110vh) rotate(560deg); opacity: 0.6; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
