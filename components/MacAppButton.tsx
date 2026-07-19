"use client";

import { Icon } from "@iconify/react";

/** Public DMG from the GitHub release - same link as README / macos docs. */
export const MAC_DMG_URL =
  "https://github.com/fozagtx/fervor/releases/download/torq-mac/Torq.dmg";

type Props = {
  /** Icon + short label for tight headers. */
  compact?: boolean;
  className?: string;
};

/** Download the native macOS notch companion. Plain <a> so it always renders. */
export default function MacAppButton({ compact = false, className = "" }: Props) {
  if (compact) {
    return (
      <a
        href={MAC_DMG_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download Torq for Mac"
        className={`inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800 ${className}`}
      >
        <Icon icon="solar:download-minimalistic-bold" width={13} />
        Mac
      </a>
    );
  }

  return (
    <a
      href={MAC_DMG_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download Torq for Mac"
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 ${className}`}
    >
      <Icon icon="solar:laptop-minimalistic-bold" width={18} />
      Download Mac app (notch)
    </a>
  );
}

/** Always-visible banner: Mac notch download. */
export function MacAppBanner({ className = "" }: { className?: string }) {
  return (
    <a
      href={MAC_DMG_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
        <Icon icon="solar:laptop-minimalistic-bold" width={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zinc-900">
          Get Torq for Mac
        </span>
        <span className="block text-xs text-zinc-600">
          Live scores + win% in your menu-bar notch. Free DMG.
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
        Download
      </span>
    </a>
  );
}
