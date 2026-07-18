"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchState, StreamMessage } from "@/lib/txline/types";

export interface StreamOptions {
  fixtureId?: number;
  replay?: boolean;
  speed?: number;
}

export interface StreamState {
  matches: Map<number, MatchState>;
  connected: boolean;
  replayDone: boolean;
}

const MAX_CLIENT_POINTS = 4000;

export function useMatchStream(opts: StreamOptions = {}) {
  const { fixtureId, replay, speed } = opts;
  const [connected, setConnected] = useState(false);
  const [replayDone, setReplayDone] = useState(false);
  const [, bump] = useState(0);
  const matchesRef = useRef<Map<number, MatchState>>(new Map());

  useEffect(() => {
    const params = new URLSearchParams();
    if (fixtureId) params.set("fixture", String(fixtureId));
    if (replay) {
      params.set("replay", "1");
      params.set("speed", String(speed ?? 30));
    }
    const es = new EventSource(`/api/stream?${params.toString()}`);
    const matches = matchesRef.current;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      let msg: StreamMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "init":
          matches.clear();
          for (const m of msg.matches) matches.set(m.fixtureId, m);
          break;
        case "prob": {
          const m = matches.get(msg.fixtureId);
          if (!m) return;
          m.probs = [...m.probs, msg.point];
          if (m.probs.length > MAX_CLIENT_POINTS) m.probs.shift();
          break;
        }
        case "score": {
          const m = matches.get(msg.fixtureId);
          if (!m) return;
          m.scoreHome = msg.scoreHome;
          m.scoreAway = msg.scoreAway;
          m.gameState = msg.gameState;
          m.minute = msg.minute;
          break;
        }
        case "event": {
          const m = matches.get(msg.event.fixtureId);
          if (!m) return;
          if (!m.events.some((e) => e.id === msg.event.id)) {
            m.events = [...m.events, msg.event];
          }
          break;
        }
        case "match":
          matches.set(msg.match.fixtureId, msg.match);
          break;
        case "replay_done":
          setReplayDone(true);
          break;
        case "heartbeat":
          return;
      }
      bump((n) => n + 1);
    };

    return () => {
      es.close();
      setConnected(false);
      setReplayDone(false);
      matchesRef.current = new Map();
    };
  }, [fixtureId, replay, speed]);

  return {
    matches: matchesRef.current,
    connected,
    replayDone,
  };
}
