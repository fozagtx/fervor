// Inspect real TxLINE payload shapes for a finished fixture
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

function parseSseOrJson(text: string): unknown[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  const out: unknown[] = [];
  for (const line of trimmed.split("\n")) {
    const m = line.match(/^data:\s*(\{.*\})\s*$/);
    if (m) { try { out.push(JSON.parse(m[1])); } catch { /* skip */ } }
  }
  return out;
}

async function main() {
  const fixtureId = Number(process.argv[2] || 18209181);
  const during = Date.UTC(2026, 6, 9, 21, 0, 0); // 2026-07-09 21:00 UTC, mid-match

  const oddsText = await rawGet(`/odds/snapshot/${fixtureId}?asOf=${during}`).catch((e) => { console.log("odds err:", String(e).slice(0,150)); return ""; });
  const odds = parseSseOrJson(oddsText);
  console.log(`=== odds snapshot asOf mid-match: ${odds.length} entries ===`);
  for (const o of odds.slice(0, 8)) console.log(JSON.stringify(o).slice(0, 400));

  const histText = await rawGet(`/scores/historical/${fixtureId}`).catch((e) => { console.log("hist err:", String(e).slice(0,150)); return ""; });
  const hist = parseSseOrJson(histText);
  console.log(`=== scores historical: ${hist.length} entries ===`);
  for (const s of hist.slice(0, 2)) console.log(JSON.stringify(s).slice(0, 700));
  console.log("--- last entry ---");
  if (hist.length) console.log(JSON.stringify(hist[hist.length - 1]).slice(0, 1000));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
