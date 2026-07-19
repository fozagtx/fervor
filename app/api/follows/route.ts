import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "follows.json");

type Store = Record<string, { teams: string[]; updated: number }>;

function read(): Store {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store));
}

/** GET /api/follows?id=xxxx - island + web sync for followed teams. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id || id.length < 4) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const row = read()[id];
  return NextResponse.json({ id, teams: row?.teams ?? [], updated: row?.updated ?? 0 });
}

/** PUT /api/follows { id, teams } */
export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: string; teams?: string[] } | null;
  const id = body?.id?.trim();
  if (!id || id.length < 4 || id.length > 32) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const teams = Array.isArray(body?.teams)
    ? [...new Set(body!.teams.filter((t) => typeof t === "string" && t.length > 0 && t.length < 40))].slice(0, 24)
    : [];
  const store = read();
  store[id] = { teams, updated: Date.now() };
  // Cap file growth
  const keys = Object.keys(store);
  if (keys.length > 500) {
    const oldest = keys
      .map((k) => ({ k, t: store[k].updated }))
      .sort((a, b) => a.t - b.t)
      .slice(0, keys.length - 400);
    for (const { k } of oldest) delete store[k];
  }
  write(store);
  return NextResponse.json({ id, teams, updated: store[id].updated });
}
