export type TxNetwork = "devnet" | "mainnet";

export const NETWORK: TxNetwork =
  (process.env.TXLINE_NETWORK as TxNetwork) || "devnet";

const HOSTS: Record<TxNetwork, string> = {
  devnet: "https://txline-dev.txodds.com",
  mainnet: "https://txline.txodds.com",
};

export const TXLINE_HOST = HOSTS[NETWORK];
export const API_BASE = `${TXLINE_HOST}/api`;
export const JWT_URL = `${TXLINE_HOST}/auth/guest/start`;

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (NETWORK === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com");

export const TOKEN_MINT_ADDRESS =
  process.env.TXLINE_TOKEN_MINT || "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG";

// Free World Cup tier: service level 1, minimum 4-week duration, no league selection
export const SERVICE_LEVEL_ID = Number(process.env.TXLINE_SERVICE_LEVEL || 1);
export const SUBSCRIPTION_WEEKS = Number(process.env.TXLINE_WEEKS || 4);

// FIFA World Cup 2026 competition id in the TxLINE dataset
export const WORLD_CUP_COMPETITION_ID = Number(
  process.env.TXLINE_COMPETITION_ID || 72
);

export const AUTH_CACHE_DIR = process.env.TXLINE_AUTH_DIR || ".txline";
export const RECORDINGS_DIR = process.env.TXLINE_RECORDINGS_DIR || "data/recordings";

export function walletSecret(): Uint8Array {
  const inline = process.env.TXLINE_WALLET_SECRET;
  if (inline) return Uint8Array.from(JSON.parse(inline));
  const path = process.env.TXLINE_WALLET_PATH || "_keys/wallet.json";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  return Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")));
}
