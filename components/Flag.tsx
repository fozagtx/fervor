"use client";

import { flagUrl } from "@/lib/flags";

const SIZES = {
  xs: { px: 16, w: 40 as const },
  sm: { px: 22, w: 40 as const },
  md: { px: 32, w: 80 as const },
  lg: { px: 48, w: 80 as const },
  xl: { px: 64, w: 160 as const },
};

/** Real national flag image (flagcdn), not emoji. */
export default function Flag({
  team,
  size = "md",
  className = "",
}: {
  team: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { px, w } = SIZES[size];
  const src = flagUrl(team, w);
  if (!src) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-zinc-200 text-[10px] font-bold text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300 ${className}`}
        style={{ width: px, height: Math.round(px * 0.75) }}
        title={team}
      >
        {team.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={px}
      height={Math.round(px * 0.75)}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 rounded-[3px] object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/15 ${className}`}
      style={{ width: px, height: Math.round(px * 0.75) }}
      title={team}
    />
  );
}
