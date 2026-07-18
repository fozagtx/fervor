"use client";

import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFavorites } from "@/lib/favorites";
import Logo from "./Logo";
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
  // Only surface a disconnect after a grace period so page loads don't flash
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
      <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
        <Logo size={38} />
        <div className="flex min-w-0 flex-col">
          <p className="whitespace-nowrap text-medium font-semibold leading-tight">Torq</p>
          <p className="truncate text-tiny leading-tight text-default-400">World Cup, second by second</p>
        </div>
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
            className="hidden cursor-pointer border-default-300 font-mono text-default-500 sm:flex"
            title="Island sync code — paste this in the macOS menu"
            onClick={copyFollowId}
          >
            <span className="flex items-center gap-1">
              <Icon icon="solar:star-bold" width={12} className={favorites.length ? "text-warning" : ""} />
              {copied ? "copied" : followId}
            </span>
          </Chip>
        )}
        <WalletButton />
        <MuteButton />
        <ThemeToggle />
      </div>
    </div>
  );
}
