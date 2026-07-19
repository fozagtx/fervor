"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

/** Public DMG from the GitHub release - same link as README / macos docs. */
export const MAC_DMG_URL =
  "https://github.com/fozagtx/fervor/releases/download/torq-mac/Torq.dmg";

type Props = {
  /** Icon + short label for tight headers. */
  compact?: boolean;
  className?: string;
};

/** Download the native macOS notch companion. */
export default function MacAppButton({ compact = false, className = "" }: Props) {
  return (
    <Button
      as="a"
      href={MAC_DMG_URL}
      target="_blank"
      rel="noopener noreferrer"
      size="sm"
      radius="full"
      variant={compact ? "light" : "bordered"}
      className={
        compact
          ? `min-w-0 px-2 font-pixel text-tiny text-zinc-700 ${className}`
          : `border-zinc-300 bg-white font-semibold text-zinc-800 ${className}`
      }
      startContent={
        <Icon
          icon="solar:download-minimalistic-bold"
          width={compact ? 14 : 16}
          className="text-zinc-700"
        />
      }
      aria-label="Download Torq for Mac"
    >
      {compact ? "Mac app" : "Download Mac app"}
    </Button>
  );
}
