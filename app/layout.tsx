import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Silkscreen } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

const pixel = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Torq - the heartbeat of the World Cup",
  description:
    "Live win chances, momentum swings and match moments for every World Cup game. Watch the market move, call the swings, relive the drama.",
  openGraph: {
    title: "Torq",
    description:
      "Every match has a heartbeat. Live win chances that move with every goal.",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Torq", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

/** White/light by default. Dark only if user explicitly chose dark. */
const themeInit = `(function(){try{var t=localStorage.getItem("torq-theme");var c=document.documentElement.classList;if(t==="dark"){c.add("dark");c.remove("light");}else{c.add("light");c.remove("dark");if(t!=="light")localStorage.setItem("torq-theme","light");}}catch(e){document.documentElement.classList.add("light");document.documentElement.classList.remove("dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`light ${plexSans.variable} ${plexMono.variable} ${pixel.variable}`}
      style={{ colorScheme: "light" }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="bg-white antialiased text-zinc-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
