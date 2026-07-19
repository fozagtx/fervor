export default function Logo({
  size = 38,
  showName = false,
}: {
  size?: number;
  /** Wordmark beside the mark — use in headers so the brand isn’t just an icon. */
  showName?: boolean;
}) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden={showName}
      aria-label={showName ? undefined : "Torq"}
      className="shrink-0"
    >
      <defs>
        <linearGradient id={`torq-logo-g-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0F8A52" />
          <stop offset="100%" stopColor="#052E1C" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#torq-logo-g-${size})`} />
      <path
        d="M7 36h11l4-9 7 16 6-22 4 15h18"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <circle cx="35" cy="21" r="6" fill="#FFFFFF" />
      <path
        d="M35 16.2l1.5 3.1 3.4.4-2.5 2.3.7 3.3-3.1-1.7-3.1 1.7.7-3.3-2.5-2.3 3.4-.4z"
        fill="#0F8A52"
      />
    </svg>
  );

  if (!showName) return mark;

  const nameSize = Math.max(18, Math.round(size * 0.62));

  return (
    <span className="inline-flex items-center gap-2.5">
      {mark}
      <span
        className="font-semibold tracking-tight text-zinc-900"
        style={{
          fontFamily: "var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif",
          fontSize: nameSize,
          lineHeight: 1,
        }}
      >
        Torq
      </span>
    </span>
  );
}
