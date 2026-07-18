import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Torq Mini",
  robots: { index: false, follow: false },
};

/** Bare shell for the floating mini scoreboard popup (no app chrome). */
export default function MiniLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="dark min-h-0 overflow-hidden bg-[#0a0a0a] text-white antialiased"
      style={{ colorScheme: "dark", height: "100dvh", maxHeight: "100dvh" }}
    >
      {children}
    </div>
  );
}
