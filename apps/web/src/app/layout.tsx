import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Oxanium, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-oxanium",
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
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/commandry-logo.png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Commandry",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#315EF0" },
    { media: "(prefers-color-scheme: dark)", color: "#05060A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${spaceGrotesk.variable} ${oxanium.variable} ${plexMono.variable}`}
    >
      <body
        style={
          {
            "--cmd-font-sans": "var(--font-space-grotesk), Space Grotesk, sans-serif",
            "--cmd-font-display": "var(--font-oxanium), Oxanium, sans-serif",
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
