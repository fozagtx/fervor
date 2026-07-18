import { NextResponse } from "next/server";
import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, PublicKey } from "@solana/web3.js";
import TxoracleJson from "@/idl/txoracle.json";
import type { Txoracle } from "@/idl/txoracle-types";
import { SOLANA_RPC_URL, WORLD_CUP_COMPETITION_ID } from "@/lib/txline/config";
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

    return NextResponse.json({
      verified: true,
      fixture: `${fixture.Participant1} vs ${fixture.Participant2}`,
      snapshotTs: v.snapshot.Ts,
      programId: program.programId.toBase58(),
      merkleRootsAccount: rootsPda.toBase58(),
      computeUnits: simulation.value.unitsConsumed,
    });
  } catch (e) {
    return NextResponse.json(
      { verified: false, error: String(e).slice(0, 300) },
      { status: 500 }
    );
  }
}
