"use client";

import { Icon } from "@iconify/react";

export default function DramaMeter({ score, compact }: { score: number; compact?: boolean }) {
  const level =
    score >= 70 ? "electric" : score >= 45 ? "spicy" : score >= 20 ? "simmering" : "calm";
  const color =
    score >= 70 ? "#F31260" : score >= 45 ? "#F5A524" : score >= 20 ? "#10B981" : "#71717A";

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" title={`Drama ${score}/100`}>
        <Icon icon="solar:fire-bold-duotone" width={13} style={{ color }} />
        <span className="font-mono text-tiny font-semibold" style={{ color }}>
          {score}
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon icon="solar:fire-bold-duotone" width={15} style={{ color }} />
          <span className="text-tiny font-medium uppercase tracking-wide text-default-500">
            Drama
          </span>
        </div>
        <span className="font-mono text-tiny font-semibold" style={{ color }}>
          {score} · {level}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-default-100">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}
