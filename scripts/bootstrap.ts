/**
 * One-shot end-to-end check of the TxLINE integration:
 * wallet → guest JWT → on-chain subscribe → activate → snapshot + streams.
 *
 * Run: pnpm bootstrap   (TXLINE_WALLET_PATH defaults to _keys/wallet.json)
 */
import { getAuth } from "../lib/txline/auth";
import { txGet } from "../lib/txline/api";
import { NETWORK, WORLD_CUP_COMPETITION_ID } from "../lib/txline/config";
import { hub } from "../lib/txline/hub";
import type { TxFixture } from "../lib/txline/types";

async function main() {
  console.log(`[bootstrap] network: ${NETWORK}`);

  const { apiToken } = await getAuth();
  console.log(`[bootstrap] credentials ok (api token ${apiToken.slice(0, 12)}…)`);

  const today = Math.floor(Date.now() / 86400000);
  const fixtures = await txGet<TxFixture[]>(
    `/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}&startEpochDay=${today - 14}`
  );
  console.log(`[bootstrap] ${fixtures.length} fixtures for competition ${WORLD_CUP_COMPETITION_ID}`);
  for (const f of fixtures.slice(0, 10)) {
    console.log(
      `  ${f.FixtureId}  ${new Date(f.StartTime).toISOString()}  ${f.Participant1} vs ${f.Participant2} (${f.Competition})`
    );
  }

  if (fixtures.length === 0) {
    const all = await txGet<TxFixture[]>(`/fixtures/snapshot?startEpochDay=${today - 14}`);
    console.log(`[bootstrap] fallback: ${all.length} fixtures across ALL competitions`);
    const comps = new Map<number, string>();
    for (const f of all) comps.set(f.CompetitionId, f.Competition);
    console.log("[bootstrap] competitions:", [...comps.entries()].slice(0, 40));
  }

  console.log("[bootstrap] starting hub (streams)… watching for 3 minutes");
  await hub.start();

  let probCount = 0;
  let scoreCount = 0;
  hub.subscribe((msg) => {
    if (msg.type === "prob") {
      probCount++;
      if (probCount <= 5) console.log("[prob]", JSON.stringify(msg));
    } else if (msg.type === "score") {
      scoreCount++;
      if (scoreCount <= 5) console.log("[score]", JSON.stringify(msg));
    } else if (msg.type === "event") {
      console.log("[event]", JSON.stringify(msg));
    }
  });

  await new Promise((r) => setTimeout(r, 180000));
  console.log(`[bootstrap] done: ${probCount} prob points, ${scoreCount} score updates`);
  console.log("[bootstrap] matches with data:");
  for (const m of hub.snapshot()) {
    if (m.probs.length || m.events.length || m.gameState !== "scheduled") {
      console.log(
        `  ${m.fixtureId} ${m.home} ${m.scoreHome}–${m.scoreAway} ${m.away} [${m.gameState}] probs=${m.probs.length} events=${m.events.length}`
      );
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[bootstrap] FAILED:", e);
  process.exit(1);
});
