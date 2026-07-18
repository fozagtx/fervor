import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Torq Embed",
  robots: { index: false, follow: false },
};

/** Bare shell for OBS / Twitch / publisher iframes. */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-dvh bg-[#0a0a0a] text-white antialiased" style={{ colorScheme: "dark" }}>
      {children}
    </div>
  );
}
