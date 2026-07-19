"use client";

import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFavorites } from "@/lib/favorites";
import Logo from "./Logo";
import MacAppButton from "./MacAppButton";
import MuteButton from "./MuteButton";
import ThemeToggle from "./ThemeToggle";
import WalletButton from "./WalletButton";

export default function TopBar({
  live,
  connected,
}: {
  live?: boolean;
  connected?: boolean;
}) {
  const [showOffline, setShowOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const { followId, favorites } = useFavorites();
  useEffect(() => {
    if (connected !== false) {
      setShowOffline(false);
      return;
    }
    const t = setTimeout(() => setShowOffline(true), 4000);
    return () => clearTimeout(t);
  }, [connected]);

  const copyFollowId = async () => {
    if (!followId) return;
    try {
      await navigator.clipboard.writeText(followId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-between rounded-large border-small border-default-200 bg-content1 px-4 py-3 shadow-sm">
      <Link href="/" className="flex shrink-0 items-center" aria-label="Torq home">
        <Logo size={38} showName />
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        {showOffline ? (
          <Chip size="sm" variant="flat" color="warning" className="font-mono">
            reconnecting…
          </Chip>
        ) : (
          live && (
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              startContent={<span className="live-dot ml-1 inline-block h-2 w-2 rounded-full bg-primary" />}
            >
              LIVE
            </Chip>
          )
        )}
        {followId && (
          <Chip
            size="sm"
            variant="bordered"
            className="cursor-pointer border-default-300 font-mono text-default-600"
            title="Mac island sync — click to copy, then Torq menu → Paste Follow Sync Code"
            onClick={copyFollowId}
          >
            <span className="flex items-center gap-1">
              <Icon icon="solar:star-bold" width={12} className={favorites.length ? "text-warning" : ""} />
              {copied ? "copied" : `sync ${followId}`}
            </span>
          </Chip>
        )}
        <MacAppButton compact />
        <WalletButton />
        <MuteButton />
        <ThemeToggle />
      </div>
    </div>
  );
}
