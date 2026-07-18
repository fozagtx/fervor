"use client";

import React, { useMemo, useRef, useState } from "react";
import type { MatchEvent, ProbPoint } from "@/lib/txline/types";

const W = 820;
const H = 300;
const PAD_TOP = 18;
const PAD_BOTTOM = 10;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;

export const COLORS = {
  home: "#10B981",
  draw: "#52525B",
  away: "#818CF8",
};

interface Props {
  probs: ProbPoint[];
  events: MatchEvent[];
  home: string;
  away: string;
}

interface Pt {
  x: number;
  y: number;
}

function smoothPath(points: Pt[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function PulseChart({ probs, events, home, away }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const model = useMemo(() => {
    if (probs.length < 2) return null;
    const pts =
      probs.length > 700
        ? probs.filter((_, i) => i % Math.ceil(probs.length / 700) === 0 || i === probs.length - 1)
        : probs;
    const t0 = pts[0].ts;
    const t1 = pts[pts.length - 1].ts;
    const span = Math.max(1, t1 - t0);
    const plotW = W - PAD_LEFT - PAD_RIGHT;
    const plotH = H - PAD_TOP - PAD_BOTTOM;
    const x = (ts: number) => PAD_LEFT + ((ts - t0) / span) * plotW;
    const y = (pct: number) => PAD_TOP + plotH - (pct / 100) * plotH;

    // stacked boundaries: b1 = home, b2 = home + draw
    const b1 = pts.map((p) => ({ x: x(p.ts), y: y(p.home) }));
    const b2 = pts.map((p) => ({ x: x(p.ts), y: y(p.home + p.draw) }));
    const floor = PAD_TOP + plotH;
    const ceil = PAD_TOP;

    const b1Path = smoothPath(b1);
    const b2Path = smoothPath(b2);
    const first = b1[0];
    const lastB1 = b1[b1.length - 1];
    const lastB2 = b2[b2.length - 1];

    const homeArea = `${b1Path} L ${lastB1.x.toFixed(1)} ${floor} L ${first.x.toFixed(1)} ${floor} Z`;
    const drawArea = `${b2Path} L ${lastB1.x.toFixed(1)} ${lastB1.y.toFixed(1)} ${reversePath(b1)} L ${b2[0].x.toFixed(1)} ${b2[0].y.toFixed(1)} Z`;
    const awayArea = `${b2Path} L ${lastB2.x.toFixed(1)} ${ceil} L ${b2[0].x.toFixed(1)} ${ceil} Z`;

    const latest = pts[pts.length - 1];
    const markers = events
      .filter((e) => e.ts >= t0 && e.ts <= t1 && ["goal", "card_red", "shift", "halftime", "fulltime", "kickoff", "penalty"].includes(e.kind))
      .map((e) => ({ e, x: x(e.ts) }));

    return { pts, x, y, b1, b2, homeArea, drawArea, awayArea, b1Path, b2Path, latest, markers, t0, t1, floor, ceil, plotH };
  }, [probs, events]);

  if (!model) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-large border border-dashed border-default-200 text-small text-default-400">
        Waiting for market data…
      </div>
    );
  }

  const { latest, markers } = model;
  const cursorPoint =
    cursor !== null
      ? model.pts.reduce((best, p) =>
          Math.abs(model.x(p.ts) - cursor) < Math.abs(model.x(best.ts) - cursor) ? p : best
        )
      : null;

  const onMove = (ev: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    if (px > PAD_LEFT && px < W - PAD_RIGHT) setCursor(px);
  };

  const shown = cursorPoint ?? latest;

  return (
    <div className="relative flex w-full select-none flex-col gap-2">
      <div className="grid grid-cols-3 items-end px-2">
        <Stat name={home} pct={shown.home} color={COLORS.home} align="left" />
        <Stat name="Draw" pct={shown.draw} color="#A1A1AA" align="center" />
        <Stat name={away} pct={shown.away} color={COLORS.away} align="right" />
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setCursor(null)}
      >
        <defs>
          <linearGradient id="gHome" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={COLORS.home} stopOpacity="0.45" />
            <stop offset="100%" stopColor={COLORS.home} stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="gAway" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.away} stopOpacity="0.4" />
            <stop offset="100%" stopColor={COLORS.away} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {[25, 50, 75].map((g) => (
          <line
            key={g}
            x1={PAD_LEFT}
            x2={W - PAD_RIGHT}
            y1={model.y(g)}
            y2={model.y(g)}
            stroke="#27272A"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
        ))}

        <path d={model.homeArea} fill="url(#gHome)" />
        <path d={model.drawArea} fill={COLORS.draw} fillOpacity="0.16" />
        <path d={model.awayArea} fill="url(#gAway)" />
        <path d={model.b1Path} fill="none" stroke={COLORS.home} strokeWidth="2.2" />
        <path d={model.b2Path} fill="none" stroke={COLORS.away} strokeWidth="2.2" />

        {markers.map(({ e, x }) => (
          <g key={e.id}>
            <line x1={x} x2={x} y1={model.ceil} y2={model.floor} stroke={markerColor(e)} strokeOpacity="0.45" strokeWidth="1.2" />
            <circle cx={x} cy={model.ceil + 7} r="6.5" fill="#121215" stroke={markerColor(e)} strokeWidth="1.4" />
            <text x={x} y={model.ceil + 10.5} textAnchor="middle" fontSize="9" fill={markerColor(e)}>
              {markerGlyph(e)}
            </text>
          </g>
        ))}

        {cursor !== null && cursorPoint && (
          <line
            x1={model.x(cursorPoint.ts)}
            x2={model.x(cursorPoint.ts)}
            y1={model.ceil}
            y2={model.floor}
            stroke="#A1A1AA"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        )}

        {/* live tip */}
        <circle cx={model.x(latest.ts)} cy={model.y(latest.home)} r="5" fill={COLORS.home} className="live-dot" />
        <circle cx={model.x(latest.ts)} cy={model.y(latest.home + latest.draw)} r="5" fill={COLORS.away} className="live-dot" />
      </svg>
      <div className="flex items-center justify-between px-2 text-tiny text-default-400">
        <span>
          {new Date(model.t0).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
        {cursorPoint ? (
          <span className="font-mono">
            {new Date(cursorPoint.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            now
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({
  name,
  pct,
  color,
  align,
}: {
  name: string;
  pct: number;
  color: string;
  align: "left" | "center" | "right";
}) {
  const alignCls =
    align === "left" ? "items-start" : align === "right" ? "items-end text-right" : "items-center";
  return (
    <div className={`flex min-w-0 flex-col ${alignCls}`}>
      <p className="w-full truncate text-tiny font-medium uppercase tracking-wide" style={{ color }}>
        {name}
      </p>
      <p className="font-mono text-2xl font-semibold tabular-nums leading-tight">
        {pct.toFixed(0)}
        <span className="text-medium text-default-400">%</span>
      </p>
    </div>
  );
}

function reversePath(points: Pt[]): string {
  let d = "";
  for (let i = points.length - 1; i >= 0; i--) {
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  return d;
}

function markerColor(e: MatchEvent): string {
  switch (e.kind) {
    case "goal":
      return "#F5A524";
    case "card_red":
      return "#F31260";
    case "shift":
      return e.side === "home" ? COLORS.home : COLORS.away;
    default:
      return "#71717A";
  }
}

function markerGlyph(e: MatchEvent): string {
  switch (e.kind) {
    case "goal":
      return "⚽";
    case "card_red":
      return "▮";
    case "shift":
      return e.delta && e.delta > 0 ? "▲" : "▼";
    case "halftime":
      return "HT";
    case "fulltime":
      return "FT";
    case "kickoff":
      return "KO";
    case "penalty":
      return "P";
    default:
      return "•";
  }
}

