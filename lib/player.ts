"use client";

/** Anonymous-but-stable player identity for the leaderboard. */
export function playerId(): string {
  try {
    let id = localStorage.getItem("torq-player-id");
    if (!id) {
      id = "fan-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("torq-player-id", id);
    }
    return id;
  } catch {
    return "fan-anonymous";
  }
}

export function playerName(): string {
  try {
    return localStorage.getItem("torq-player-name") || `Fan ${playerId().slice(4, 8)}`;
  } catch {
    return "Fan";
  }
}

export function setPlayerName(name: string) {
  try {
    localStorage.setItem("torq-player-name", name.slice(0, 24));
  } catch {
    // private browsing
  }
}
