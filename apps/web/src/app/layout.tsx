import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Outfit, Syne } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
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
    { media: "(prefers-color-scheme: light)", color: "#E11D48" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1020" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${outfit.variable} ${syne.variable} ${plexMono.variable}`}
    >
      <body
        style={
          {
            "--cmd-font-sans": "var(--font-outfit), Outfit, sans-serif",
            "--cmd-font-display": "var(--font-syne), Syne, sans-serif",
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
