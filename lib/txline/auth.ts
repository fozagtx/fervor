import fs from "fs";
import path from "path";
import nacl from "tweetnacl";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import TxoracleJson from "@/idl/txoracle.json";
import type { Txoracle } from "@/idl/txoracle-types";
import {
  API_BASE,
  AUTH_CACHE_DIR,
  JWT_URL,
  NETWORK,
  SERVICE_LEVEL_ID,
  SOLANA_RPC_URL,
  SUBSCRIPTION_WEEKS,
  TOKEN_MINT_ADDRESS,
  walletSecret,
} from "./config";

interface AuthCache {
  jwt: string;
  apiToken: string;
  wallet: string;
  txSig?: string;
  activatedAt?: number;
}

/** Minimal anchor-compatible wallet (anchor's ESM build doesn't export Wallet). */
class KeypairWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> {
    if ("partialSign" in tx) tx.partialSign(this.payer);
    else tx.sign([this.payer]);
    return tx;
  }
  async signAllTransactions<T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> {
    for (const tx of txs) await this.signTransaction(tx);
    return txs;
  }
}

const cacheFile = () => path.join(AUTH_CACHE_DIR, `${NETWORK}-auth.json`);

function readCache(): AuthCache | null {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(), "utf8"));
  } catch {
    return null;
  }
}

function writeCache(cache: AuthCache) {
  fs.mkdirSync(AUTH_CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(), JSON.stringify(cache, null, 2));
}

let state: AuthCache | null = null;
let activating: Promise<AuthCache> | null = null;

export async function fetchGuestJwt(): Promise<string> {
  const res = await fetch(JWT_URL, { method: "POST" });
  if (!res.ok) throw new Error(`guest/start failed: ${res.status}`);
  const body = (await res.json()) as { token: string };
  return body.token;
}

/** Renew the guest JWT in-place (called on 401s). The API token stays valid. */
export async function renewJwt(): Promise<string> {
  const jwt = await fetchGuestJwt();
  if (state) {
    state.jwt = jwt;
    writeCache(state);
  }
  return jwt;
}

/**
 * On-chain free-tier subscription: create the Token-2022 ATA if needed, call
 * `subscribe(serviceLevel, weeks)` as fee payer, then activate the API token
 * off-chain by signing `${txSig}:${leagues}:${jwt}` with the wallet key.
 */
async function subscribeAndActivate(jwt: string): Promise<AuthCache> {
  const secret = walletSecret();
  const keypair = Keypair.fromSecretKey(secret);
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const wallet = new KeypairWallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new anchor.Program<Txoracle>(
    TxoracleJson as unknown as Txoracle,
    provider
  );
  const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);

  const ataAddress = getAssociatedTokenAddressSync(
    tokenMint,
    keypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const ataInfo = await connection.getAccountInfo(ataAddress);
  if (!ataInfo) {
    console.log("[txline] creating Token-2022 ATA…");
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey,
        ataAddress,
        keypair.publicKey,
        tokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [keypair], {
      commitment: "confirmed",
    });
    await new Promise((r) => setTimeout(r, 3000));
  }

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    tokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(
    `[txline] subscribing on-chain: level ${SERVICE_LEVEL_ID}, ${SUBSCRIPTION_WEEKS} weeks…`
  );
  const tx = await program.methods
    .subscribe(SERVICE_LEVEL_ID, SUBSCRIPTION_WEEKS)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint,
      userTokenAccount: ataAddress,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .transaction();

  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  tx.feePayer = keypair.publicKey;
  tx.sign(keypair);
  const txSig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    {
      signature: txSig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed"
  );
  console.log(`[txline] subscribe confirmed: ${txSig}`);

  const leagues: number[] = [];
  const message = new TextEncoder().encode(
    `${txSig}:${leagues.join(",")}:${jwt}`
  );
  const signature = Buffer.from(
    nacl.sign.detached(message, keypair.secretKey)
  ).toString("base64");

  const res = await fetch(`${API_BASE}/token/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ txSig, walletSignature: signature, leagues }),
  });
  if (!res.ok) {
    throw new Error(`token/activate failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json().catch(() => null)) as
    | { token?: string }
    | string
    | null;
  const apiToken =
    typeof body === "string" ? body : body?.token ?? String(body);
  if (!apiToken) throw new Error("activation returned no token");
  console.log("[txline] API token activated");

  return {
    jwt,
    apiToken,
    wallet: keypair.publicKey.toBase58(),
    txSig,
    activatedAt: Date.now(),
  };
}

/** Get working credentials, running the full subscribe flow at most once. */
export async function getAuth(): Promise<{ jwt: string; apiToken: string }> {
  if (state?.apiToken && state.jwt) return state;
  const cached = readCache();
  if (cached?.apiToken && cached.jwt) {
    state = cached;
    return cached;
  }
  if (!activating) {
    activating = (async () => {
      const jwt = cached?.jwt || (await fetchGuestJwt());
      const fresh = await subscribeAndActivate(jwt);
      writeCache(fresh);
      state = fresh;
      return fresh;
    })().finally(() => {
      activating = null;
    });
  }
  return activating;
}
