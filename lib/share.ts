import type { MatchState } from "@/lib/txline/types";
import { biggestSwing, dramaPeak } from "@/lib/drama";

/** Deep link friends can open to watch the same match together. */
export function watchPath(
  fixtureId: number,
  opts?: { moment?: string; teams?: string[]; replay?: boolean }
): string {
  const q = new URLSearchParams();
  if (opts?.moment) q.set("m", opts.moment);
  if (opts?.teams?.length) q.set("teams", opts.teams.join(","));
  if (opts?.replay) q.set("replay", "1");
  const qs = q.toString();
  return `/watch/${fixtureId}${qs ? `?${qs}` : ""}`;
}

export function watchUrl(
  origin: string,
  fixtureId: number,
  opts?: { moment?: string; teams?: string[]; replay?: boolean }
): string {
  return `${origin.replace(/\/$/, "")}${watchPath(fixtureId, opts)}`;
}

export function embedPath(fixtureId: number): string {
  return `/embed/${fixtureId}`;
}

/** Copy for FT / goal share cards. */
export function matchShareText(match: MatchState): string {
  const swing = biggestSwing(match.probs);
  const peak = dramaPeak(match);
  const swingText = swing
    ? ` Biggest swing: ${swing.side === "home" ? match.home : match.away} ${swing.delta > 0 ? "+" : ""}${swing.delta}pp.`
    : "";
  return `${match.home} ${match.scoreHome}–${match.scoreAway} ${match.away}. Drama peak ${peak}/100.${swingText} Watch with me on Torq.`;
}

export async function shareWatch(
  match: MatchState,
  opts?: { moment?: string; teams?: string[]; replay?: boolean }
): Promise<"shared" | "copied" | "dismissed"> {
  const url = watchUrl(location.origin, match.fixtureId, {
    moment: opts?.moment,
    teams: opts?.teams ?? [match.home, match.away],
    replay: opts?.replay,
  });
  const text = matchShareText(match);
  try {
    if (navigator.share) {
      await navigator.share({ title: "Torq", text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "dismissed";
  }
}
