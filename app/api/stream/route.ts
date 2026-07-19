import { hub } from "@/lib/txline/hub";
import { historyFor, startReplay } from "@/lib/txline/replay";
import type { MatchState, StreamMessage } from "@/lib/txline/types";

export const dynamic = "force-dynamic";

function slimProbs(m: MatchState, max = 120): MatchState {
  if (m.probs.length <= max) return m;
  const stride = Math.ceil(m.probs.length / max);
  return {
    ...m,
    probs: m.probs.filter((_, i) => i % stride === 0 || i === m.probs.length - 1),
  };
}

function withFinishedWave(m: MatchState): MatchState {
  const finished = /(ft|full|final|ended|finish)/i.test(m.gameState);
  if (!finished || m.probs.length >= 8) return slimProbs(m);
  const history = historyFor(m);
  if (!history || history.probs.length < 5) return slimProbs(m);
  return slimProbs({ ...m, probs: history.probs, events: history.events });
}

/** Browser-facing SSE: initial snapshot then live increments, or a replay. */
export async function GET(req: Request) {
  await hub.start();

  const { searchParams } = new URL(req.url);
  const fixtureFilter = searchParams.get("fixture");
  const fixtureId = fixtureFilter ? Number(fixtureFilter) : null;
  const replay = searchParams.get("replay") === "1" && fixtureId !== null;
  const speed = Math.min(120, Math.max(1, Number(searchParams.get("speed") || 30)));

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (msg: StreamMessage) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      };

      if (replay && fixtureId) {
        const stop = startReplay(fixtureId, speed, (msg) => {
          try {
            send(msg);
          } catch {
            stop();
          }
        });
        cleanup = () => {
          stop();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
        return;
      }

      const matches = hub
        .snapshot()
        .filter((m) => (fixtureId ? m.fixtureId === fixtureId : true))
        .map(withFinishedWave);
      send({ type: "init", matches });

      const unsubscribe = hub.subscribe((msg) => {
        if (fixtureId && "fixtureId" in msg && msg.fixtureId !== fixtureId) return;
        if (fixtureId && msg.type === "event" && msg.event.fixtureId !== fixtureId) return;
        try {
          send(msg);
        } catch {
          unsubscribe();
        }
      });

      cleanup = () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
    },
    cancel() {
      cleanup();
    },
  });

  req.signal.addEventListener("abort", () => cleanup());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
