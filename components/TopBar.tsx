"use client";

import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";
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
  useEffect(() => {
    if (connected !== false) {
      setShowOffline(false);
      return;
    }
    const t = setTimeout(() => setShowOffline(true), 4000);
    return () => clearTimeout(t);
  }, [connected]);
  return (
    <div className="flex items-center justify-between rounded-large border-small border-default-200 bg-content1 px-4 py-3 shadow-sm">
      <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
        <Logo size={38} />
        <div className="flex min-w-0 flex-col">
          <p className="whitespace-nowrap text-medium font-semibold leading-tight">Match Pulse</p>
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
        <Chip size="sm" variant="bordered" className="hidden border-default-300 text-default-500 sm:flex">
          <span className="flex items-center gap-1">
            <Icon icon="solar:bolt-linear" width={13} />
            TxLINE
          </span>
        </Chip>
        <WalletButton />
        <ThemeToggle />
      </div>
    </div>
  );
}
