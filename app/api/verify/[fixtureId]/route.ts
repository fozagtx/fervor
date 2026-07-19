import { NextResponse } from "next/server";
import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, PublicKey } from "@solana/web3.js";
import TxoracleJson from "@/idl/txoracle.json";
import type { Txoracle } from "@/idl/txoracle-types";
import { API_BASE, SOLANA_RPC_URL, WORLD_CUP_COMPETITION_ID } from "@/lib/txline/config";
import { getAuth } from "@/lib/txline/auth";
import { txGet } from "@/lib/txline/api";
import type { TxFixture } from "@/lib/txline/types";

export const dynamic = "force-dynamic";

// Any funded devnet account works as the simulated fee payer; no secret
// key is required because the validation runs as a view-only simulation.
const FEE_PAYER = new PublicKey(
  process.env.TXLINE_WALLET_PUBKEY || "DqRnNKLQi2vmrKmCzg5swHpayGnsJLc6H2HQ4KzjhdJN"
);

/** Read-only wallet: satisfies anchor's provider interface for simulations. */
const readOnlyWallet = {
  publicKey: FEE_PAYER,
  signTransaction: async <T,>(tx: T) => tx,
  signAllTransactions: async <T,>(txs: T[]) => txs,
};

interface ValidationResponse {
  snapshot: {
    Ts: number;
    StartTime: number;
    Competition: string;
    CompetitionId: number;
    FixtureGroupId: number;
    Participant1Id: number;
    Participant1: string;
    Participant2Id: number;
    Participant2: string;
    FixtureId: number;
    Participant1IsHome: boolean;
  };
  summary: {
    fixtureId: number;
    competitionId: number;
    competition: string;
    updateStats: { updateCount: number; minTimestamp: number; maxTimestamp: number };
    updateSubTreeRoot: unknown;
  };
  subTreeProof: unknown;
  mainTreeProof: unknown;
}

interface ProofNodeApi {
  hash: number[];
  isRightSibling: boolean;
}

const mapProof = (nodes: ProofNodeApi[]) =>
  nodes.map((n) => ({ hash: Array.from(n.hash), isRightSibling: n.isRightSibling }));

async function rawGetText(pathAndQuery: string, jwt: string, apiToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

function parseSseLines<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^data:\s*(\{.*\})\s*$/);
    if (m) {
      try {
        out.push(JSON.parse(m[1]) as T);
      } catch {
        // skip malformed line
      }
    }
  }
  return out;
}

/**
 * Proves the final scoreline on-chain: fetches the Merkle proof for the last
 * scores message's goal stats and simulates validateStatV2 with EqualTo
 * predicates for both teams' goals. Returns null when unavailable.
 */
async function proveScoreline(
  program: anchor.Program<Txoracle>,
  connection: Connection,
  id: number,
  jwt: string,
  apiToken: string
): Promise<{ p1Goals: number; p2Goals: number; rootsAccount: string; computeUnits?: number } | null> {
  const hist = parseSseLines<{ Seq?: number; Stats?: Record<string, number>; FixtureId?: number }>(
    await rawGetText(`/scores/historical/${id}`, jwt, apiToken)
  );
  const withStats = hist.filter(
    (e) => e.FixtureId === id && e.Stats && "1" in e.Stats && "1001" in e.Stats
  );
  const last = withStats[withStats.length - 1];
  if (!last?.Seq) return null;

  const valText = await rawGetText(
    `/scores/stat-validation?fixtureId=${id}&seq=${last.Seq}&statKeys=1,1001`,
    jwt,
    apiToken
  );
  const v = JSON.parse(valText);
  const stats: Array<{ key: number; value: number }> = v.statsToProve || [];
  if (stats.length !== 2) return null;
  const p1Goals = stats[0].value;
  const p2Goals = stats[1].value;

  const targetTs = v.summary.updateStats.minTimestamp;
  const epochDay = Math.floor(targetTs / 86400000);
  const [dailyScoresPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new anchor.BN(epochDay).toBuffer("le", 2)],
    program.programId
  );

  const payload = {
    ts: new anchor.BN(targetTs),
    fixtureSummary: {
      fixtureId: new anchor.BN(v.summary.fixtureId),
      updateStats: {
        updateCount: v.summary.updateStats.updateCount,
        minTimestamp: new anchor.BN(v.summary.updateStats.minTimestamp),
        maxTimestamp: new anchor.BN(v.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: Array.from(v.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: mapProof(v.subTreeProof),
    mainTreeProof: mapProof(v.mainTreeProof),
    eventStatRoot: Array.from(v.eventStatRoot),
    stats: (v.statsToProve as unknown[]).map((statObj, index: number) => ({
      stat: statObj,
      statProof: mapProof(v.statProofs[index]),
    })),
  };

  const strategy = {
    geometricTargets: [],
    distancePredicate: null,
    discretePredicates: [
      { single: { index: 0, predicate: { threshold: p1Goals, comparison: { equalTo: {} } } } },
      { single: { index: 1, predicate: { threshold: p2Goals, comparison: { equalTo: {} } } } },
    ],
  };

  const tx = await program.methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .validateStatV2(payload as any, strategy as any)
    .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
    .transaction();
  tx.feePayer = FEE_PAYER;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) return null;

  return {
    p1Goals,
    p2Goals,
    rootsAccount: dailyScoresPda.toBase58(),
    computeUnits: sim.value.unitsConsumed,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const id = Number(fixtureId);

  try {
    // Locate the fixture's canonical snapshot timestamp
    const today = Math.floor(Date.now() / 86400000);
    const fixtures = await txGet<TxFixture[]>(
      `/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}&startEpochDay=${today - 14}`
    );
    const fixture = fixtures.find((f) => f.FixtureId === id);
    if (!fixture) {
      return NextResponse.json({ verified: false, error: "fixture not found" }, { status: 404 });
    }

    const validation = await txGet<ValidationResponse>(
      `/fixtures/validation?fixtureId=${id}&timestamp=${fixture.Ts}`
    );

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const provider = new anchor.AnchorProvider(
      connection,
      readOnlyWallet as anchor.Wallet,
      { commitment: "confirmed" }
    );
    const program = new anchor.Program<Txoracle>(
      TxoracleJson as unknown as Txoracle,
      provider
    );

    const v = validation;
    const snapshot = {
      ts: new anchor.BN(v.snapshot.Ts),
      startTime: new anchor.BN(v.snapshot.StartTime),
      competition: v.snapshot.Competition,
      competitionId: v.snapshot.CompetitionId,
      fixtureGroupId: v.snapshot.FixtureGroupId,
      participant1Id: v.snapshot.Participant1Id,
      participant1: v.snapshot.Participant1,
      participant2Id: v.snapshot.Participant2Id,
      participant2: v.snapshot.Participant2,
      fixtureId: new anchor.BN(v.snapshot.FixtureId),
      participant1IsHome: v.snapshot.Participant1IsHome,
    };
    const summary = {
      fixtureId: new anchor.BN(v.summary.fixtureId),
      competitionId: v.summary.competitionId,
      competition: v.summary.competition,
      updateStats: {
        updateCount: v.summary.updateStats.updateCount,
        minTimestamp: new anchor.BN(v.summary.updateStats.minTimestamp),
        maxTimestamp: new anchor.BN(v.summary.updateStats.maxTimestamp),
      },
      updateSubTreeRoot: v.summary.updateSubTreeRoot,
    };

    const epochDay = Math.floor(v.snapshot.Ts / 86400000);
    const windowStartDay = Math.floor(epochDay / 10) * 10;
    const windowStartBuffer = Buffer.alloc(2);
    windowStartBuffer.writeUInt16LE(windowStartDay, 0);
    const [rootsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ten_daily_fixtures_roots"), windowStartBuffer],
      program.programId
    );

    const tx = await program.methods
      .validateFixture(
        snapshot,
        summary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        v.subTreeProof as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        v.mainTreeProof as any
      )
      .accounts({ tenDailyFixturesRoots: rootsPda })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })])
      .transaction();

    tx.feePayer = FEE_PAYER;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const simulation = await connection.simulateTransaction(tx);
    if (simulation.value.err) {
      return NextResponse.json(
        {
          verified: false,
          error: JSON.stringify(simulation.value.err),
          logs: simulation.value.logs?.slice(-5),
        },
        { status: 422 }
      );
    }

    // Second proof: the final scoreline itself (best effort - some fixtures
    // have no stat coverage; the fixture proof alone still stands)
    let score: Awaited<ReturnType<typeof proveScoreline>> = null;
    try {
      const { jwt, apiToken } = await getAuth();
      score = await proveScoreline(program, connection, id, jwt, apiToken);
    } catch {
      score = null;
    }

    return NextResponse.json({
      verified: true,
      fixture: `${fixture.Participant1} vs ${fixture.Participant2}`,
      snapshotTs: v.snapshot.Ts,
      programId: program.programId.toBase58(),
      merkleRootsAccount: rootsPda.toBase58(),
      computeUnits: simulation.value.unitsConsumed,
      score: score
        ? {
            proven: true,
            scoreline: `${score.p1Goals}–${score.p2Goals}`,
            participant1: fixture.Participant1,
            participant2: fixture.Participant2,
            merkleRootsAccount: score.rootsAccount,
            computeUnits: score.computeUnits,
          }
        : { proven: false },
    });
  } catch (e) {
    return NextResponse.json(
      { verified: false, error: String(e).slice(0, 300) },
      { status: 500 }
    );
  }
}
