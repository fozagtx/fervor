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
  /** Increments on every stream update — use in useMemo deps (Map ref is stable). */
  revision: number;
}

const MAX_CLIENT_POINTS = 4000;

export function useMatchStream(opts: StreamOptions = {}) {
  const { fixtureId, replay, speed } = opts;
  const [connected, setConnected] = useState(false);
  const [replayDone, setReplayDone] = useState(false);
  const [revision, setRevision] = useState(0);
  const matchesRef = useRef<Map<number, MatchState>>(new Map());

  // Lobby: hydrate from REST immediately so remaining matches show before SSE.
  useEffect(() => {
    if (fixtureId || replay) return;
    let cancelled = false;
    fetch("/api/matches")
      .then((r) => r.json())
      .then((data: { matches?: MatchState[] }) => {
        if (cancelled || !Array.isArray(data.matches)) return;
        const matches = matchesRef.current;
        for (const m of data.matches) {
          const prev = matches.get(m.fixtureId);
          // Don't clobber a richer live buffer already streamed in
          if (prev && prev.probs.length > (m.probs?.length ?? 0)) continue;
          matches.set(m.fixtureId, m);
        }
        setConnected(true);
        setRevision((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fixtureId, replay]);

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
          // Merge — don't wipe REST hydrate if stream payload is thinner
          for (const m of msg.matches) {
            const prev = matches.get(m.fixtureId);
            if (prev && prev.probs.length > m.probs.length && prev.gameState === m.gameState) {
              matches.set(m.fixtureId, {
                ...m,
                probs: prev.probs,
                events: prev.events.length >= m.events.length ? prev.events : m.events,
              });
            } else {
              matches.set(m.fixtureId, m);
            }
          }
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
      setRevision((n) => n + 1);
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
    revision,
  };
}
