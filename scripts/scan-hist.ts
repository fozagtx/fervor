import { API_BASE } from "../lib/txline/config";
import { getAuth, renewJwt } from "../lib/txline/auth";

async function rawGet(path: string): Promise<string> {
  const { jwt, apiToken } = await getAuth();
  const doFetch = (t: string) =>
    fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${t}`, "X-Api-Token": apiToken } });
  let res = await doFetch(jwt);
  if (res.status === 401) res = await doFetch(await renewJwt());
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.text();
}

function parseSse(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const line of text.trim().split("\n")) {
    const m = line.match(/^data:\s*(\{.*\})\s*$/);
    if (m) { try { out.push(JSON.parse(m[1])); } catch { /* skip */ } }
  }
  return out;
}

async function main() {
  const fixtureId = Number(process.argv[2] || 18209181);
  const hist = parseSse(await rawGet(`/scores/historical/${fixtureId}`));
  console.log("entries:", hist.length);

  const actions = new Map<string, number>();
  const states = new Map<string, number>();
  const keys = new Set<string>();
  for (const h of hist) {
    actions.set(String(h.Action), (actions.get(String(h.Action)) || 0) + 1);
    states.set(String(h.GameState), (states.get(String(h.GameState)) || 0) + 1);
    for (const k of Object.keys(h)) keys.add(k);
  }
  console.log("actions:", [...actions.entries()].sort((a,b)=>b[1]-a[1]));
  console.log("gameStates:", [...states.entries()]);
  console.log("all keys:", [...keys].join(","));

  const interesting = hist.filter((h) => !["comment","coverage_update","connected","disconnected","clock_update"].includes(String(h.Action)));
  console.log("non-noise entries:", interesting.length);
  for (const h of interesting.slice(0, 12)) {
    console.log(String(h.Action), "|", String(h.GameState), "|", JSON.stringify(h.Data ?? {}).slice(0, 220));
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
