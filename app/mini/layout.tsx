import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Torq",
  robots: { index: false, follow: false },
};

/** Popup shell only — full tabs never reach here (middleware redirects). */
export default function MiniLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
