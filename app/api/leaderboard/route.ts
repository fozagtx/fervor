import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface Entry {
  id: string;
  name: string;
  points: number;
  streak: number;
  best: number;
  wins: number;
  plays: number;
  updatedAt: number;
}

const FILE = path.join("data", "leaderboard.json");
let store: Record<string, Entry> | null = null;

function load(): Record<string, Entry> {
  if (store) return store;
  try {
    store = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    store = {};
  }
  return store!;
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(store ?? {}));
    } catch {
      // volume unavailable; stays in memory
    }
  }, 2000);
}

export async function GET() {
  const s = load();
  const top = Object.values(s)
    .sort((a, b) => b.points - a.points)
    .slice(0, 50);
  return NextResponse.json({ top });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<Entry> | null;
  if (
    !body?.id ||
    typeof body.points !== "number" ||
    body.id.length > 64 ||
    (body.name && body.name.length > 24)
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const s = load();
  const prev = s[body.id];
  // Records only move forward; a wiped browser cannot erase the board
  s[body.id] = {
    id: body.id,
    name: (body.name || prev?.name || "anonymous fan").slice(0, 24),
    points: Math.max(prev?.points ?? 0, Math.floor(body.points)),
    streak: Math.floor(body.streak ?? 0),
    best: Math.max(prev?.best ?? 0, Math.floor(body.best ?? 0)),
    wins: Math.max(prev?.wins ?? 0, Math.floor(body.wins ?? 0)),
    plays: Math.max(prev?.plays ?? 0, Math.floor(body.plays ?? 0)),
    updatedAt: Date.now(),
  };
  persist();
  const rank = Object.values(s)
    .sort((a, b) => b.points - a.points)
    .findIndex((e) => e.id === body.id) + 1;
  return NextResponse.json({ rank });
}
