import { API_BASE } from "../lib/txline/config";
import { getAuth, renewJwt } from "../lib/txline/auth";

async function rawGet(p: string): Promise<{ status: number; text: string }> {
  const { jwt, apiToken } = await getAuth();
  const doFetch = (t: string) =>
    fetch(`${API_BASE}${p}`, { headers: { Authorization: `Bearer ${t}`, "X-Api-Token": apiToken } });
  let res = await doFetch(jwt);
  if (res.status === 401) res = await doFetch(await renewJwt());
  return { status: res.status, text: await res.text() };
}

async function main() {
  const fixtureId = 18209181;
  // last scores entry: find seq with final stats from historical
  const hist = await rawGet(`/scores/historical/${fixtureId}`);
  const entries = hist.text.split("\n").flatMap((l) => {
    const m = l.match(/^data:\s*(\{.*\})\s*$/);
    if (!m) return [];
    try { return [JSON.parse(m[1])]; } catch { return []; }
  });
  const withStats = entries.filter((e) => e.Stats && Object.keys(e.Stats).length > 3);
  const last = withStats[withStats.length - 1];
  console.log("last seq:", last.Seq, "stats sample:", JSON.stringify(last.Stats).slice(0, 160));

  const val = await rawGet(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${last.Seq}&statKeys=1,1001`);
  console.log("validation status:", val.status);
  if (val.status === 200) {
    const v = JSON.parse(val.text);
    console.log("keys:", Object.keys(v).join(","));
    console.log("statsToProve:", JSON.stringify(v.statsToProve));
  } else {
    console.log(val.text.slice(0, 300));
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
