import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Sora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Commandry",
    template: "%s · Commandry",
  },
  description: "The operating system for ER:LC communities.",
  applicationName: "Commandry",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Commandry",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F766E" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1412" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sora.variable} ${fraunces.variable} ${plexMono.variable}`}
    >
      <body
        style={
          {
            "--cmd-font-sans": "var(--font-sora), Sora, sans-serif",
            "--cmd-font-display": "var(--font-fraunces), Fraunces, serif",
            "--cmd-font-mono": "var(--font-plex-mono), monospace",
          } as React.CSSProperties
        }
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
