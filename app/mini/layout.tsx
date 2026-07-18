import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Torq",
  robots: { index: false, follow: false },
};

/** No app chrome — just the scoreboard. */
export default function MiniLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
