import fs from "fs";
import path from "path";

export type ReactionKind = "fire" | "shock" | "ball";

type Store = Record<string, Partial<Record<ReactionKind, number>>>;

const FILE = path.join("data", "reactions.json");

let store: Store | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Store {
  if (store) return store;
  try {
    store = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    store = {};
  }
  return store!;
}

function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(store ?? {}));
    } catch {
      // volume unavailable; counts stay in memory
    }
  }, 2000);
}

export function getReactions(ids: string[]): Store {
  const s = load();
  const out: Store = {};
  for (const id of ids) if (s[id]) out[id] = s[id];
  return out;
}

export function addReaction(id: string, kind: ReactionKind): Partial<Record<ReactionKind, number>> {
  const s = load();
  if (!s[id]) s[id] = {};
  s[id][kind] = (s[id][kind] ?? 0) + 1;
  persist();
  return s[id];
}

// Basic per-IP rate limiting
const hits = new Map<string, { count: number; windowStart: number }>();
export function allowReaction(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.windowStart > 60000) {
    hits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  h.count += 1;
  return h.count <= 40;
}
