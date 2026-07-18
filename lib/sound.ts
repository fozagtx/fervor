"use client";

import { useEffect, useState } from "react";

const KEY = "torq-sound";

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
    window.dispatchEvent(new Event("torq-sound-change"));
  } catch {
    // private browsing
  }
}

/** Global audio switch shared by stadium sounds and the pundit voice. */
export function useSound() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(soundEnabled());
    const sync = () => setOn(soundEnabled());
    window.addEventListener("torq-sound-change", sync);
    return () => window.removeEventListener("torq-sound-change", sync);
  }, []);
  return { on, toggle: () => setSoundEnabled(!soundEnabled()) };
}

export function playSound(src: string, volume = 1) {
  if (!soundEnabled()) return;
  try {
    const a = new Audio(src);
    a.volume = volume;
    void a.play().catch(() => {});
  } catch {
    // blocked until first interaction
  }
}
