import type { MatchEvent, MatchState } from "@/lib/txline/types";

/**
 * Turns a match event into a spoken pundit line, using the probability
 * series to describe what the market did around the moment.
 */
export function punditLine(event: MatchEvent, match: MatchState): string | null {
  const probs = match.probs;
  const latest = probs[probs.length - 1];

  const marketView = (side: "home" | "away" | undefined): string => {
    if (!latest) return "";
    const team = side === "away" ? match.away : match.home;
    const pct = side === "away" ? latest.away : latest.home;
    const before = [...probs].reverse().find((p) => latest.ts - p.ts >= 2.5 * 60000);
    if (!before) return ` The market has ${team} at ${pct.toFixed(0)} percent.`;
    const delta = (side === "away" ? latest.away - before.away : latest.home - before.home);
    if (Math.abs(delta) < 2) return ` The market holds ${team} at ${pct.toFixed(0)} percent.`;
    return ` The market now has ${team} at ${pct.toFixed(0)} percent, ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(0)} points.`;
  };

  const min = event.minute !== undefined ? `${Math.floor(event.minute)}th minute. ` : "";

  switch (event.kind) {
    case "goal": {
      const team = event.side === "away" ? match.away : match.home;
      return `${min}Goal! ${team} strike, ${match.scoreHome} ${match.scoreAway}.${marketView(event.side)}`;
    }
    case "card_red": {
      const team = event.side === "away" ? match.away : match.home;
      return `${min}Red card! ${team} are down to ten.${marketView(event.side === "home" ? "away" : "home")}`;
    }
    case "shift": {
      const team = event.side === "away" ? match.away : match.home;
      const dir = (event.delta ?? 0) > 0 ? "piling onto" : "backing away from";
      return `${min}Watch the odds, something is happening. The money is ${dir} ${team}, a ${Math.abs(event.delta ?? 0).toFixed(0)} point move without a goal.`;
    }
    case "kickoff":
      return `We're underway. ${match.home} against ${match.away}.${marketView("home")}`;
    case "halftime":
      return `Half time. ${match.home} ${match.scoreHome}, ${match.away} ${match.scoreAway}.${marketView("home")}`;
    case "fulltime":
      return `Full time! It finishes ${match.home} ${match.scoreHome}, ${match.away} ${match.scoreAway}.`;
    case "penalty":
      return `${min}Penalty!${marketView(event.side)}`;
    default:
      return null;
  }
}

let voiceCache: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (voiceCache) return voiceCache;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const preferred =
    voices.find((v) => /en-GB/i.test(v.lang) && /Daniel|Arthur|Serena/i.test(v.name)) ||
    voices.find((v) => /en-GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang));
  voiceCache = preferred ?? null;
  return voiceCache;
}

export function speak(line: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(line);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 1.04;
  utterance.pitch = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
