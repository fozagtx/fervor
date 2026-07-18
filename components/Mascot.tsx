"use client";

import { useEffect, useState } from "react";
import { MASCOT_COLORS, MASCOT_IDLE, MASCOT_KICK } from "@/lib/mascot-frames";

function Frame({ rows, size }: { rows: string[]; size: number }) {
  const px = size / 16;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x * px}
              y={y * px}
              width={px}
              height={px}
              fill={MASCOT_COLORS[c]}
            />
          )
        )
      )}
    </svg>
  );
}

/**
 * Beat, the pixel football. Bounces gently; kicks when celebrating.
 */
export default function Mascot({
  size = 40,
  celebrate = false,
}: {
  size?: number;
  celebrate?: boolean;
}) {
  const [kick, setKick] = useState(false);

  useEffect(() => {
    if (!celebrate) return;
    setKick(true);
    const t = setInterval(() => setKick((k) => !k), 220);
    const stop = setTimeout(() => {
      clearInterval(t);
      setKick(false);
    }, 1800);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [celebrate]);

  return (
    <span
      className="inline-block"
      style={{
        animation: celebrate ? undefined : "mascot-bounce 1.4s ease-in-out infinite",
      }}
      aria-label="Beat, the Torq mascot"
      role="img"
    >
      <Frame rows={kick ? MASCOT_KICK : MASCOT_IDLE} size={size} />
      <style>{`
        @keyframes mascot-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </span>
  );
}
