"use client";

import { useCallback, useEffect, useState } from "react";

interface SolanaProvider {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
}

function getProvider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { solana?: SolanaProvider; phantom?: { solana?: SolanaProvider } };
  return w.phantom?.solana ?? w.solana ?? null;
}

const TRUSTED_KEY = "torq-wallet-trusted";

/**
 * Minimal optional wallet connection (Phantom or any injected Solana
 * provider). Used only as an identity to save the fan's call record -
 * never for transactions.
 */
export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;
    setAvailable(true);

    // Silent reconnect if the user connected before
    if (localStorage.getItem(TRUSTED_KEY) === "1") {
      provider
        .connect({ onlyIfTrusted: true })
        .then((res) => setAddress(res.publicKey.toBase58()))
        .catch(() => {
          // not trusted anymore; stay disconnected
        });
    }

    provider.on?.("accountChanged", (...args: unknown[]) => {
      const key = args[0] as { toBase58(): string } | null;
      setAddress(key ? key.toBase58() : null);
    });
    provider.on?.("disconnect", () => setAddress(null));
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    try {
      const res = await provider.connect();
      setAddress(res.publicKey.toBase58());
      localStorage.setItem(TRUSTED_KEY, "1");
    } catch {
      // user dismissed the popup
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    try {
      await provider?.disconnect();
    } catch {
      // already disconnected
    }
    setAddress(null);
    localStorage.removeItem(TRUSTED_KEY);
  }, []);

  return { address, available, connect, disconnect };
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
