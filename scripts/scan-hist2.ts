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
  const want = new Set(["goal", "kickoff", "status", "halftime_finalised", "game_finalised", "yellow_card", "penalty", "clock_adjustment"]);
  for (const h of hist) {
    if (!want.has(String(h.Action))) continue;
    const slim = { Action: h.Action, StatusId: h.StatusId, Score: h.Score, Clock: h.Clock, Type: h.Type, Participant: h.Participant, Confirmed: h.Confirmed, Data: h.Data, Ts: h.Ts };
    console.log(JSON.stringify(slim).slice(0, 380));
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
