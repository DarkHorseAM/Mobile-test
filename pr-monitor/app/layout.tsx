import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PR Campaign Monitor",
  description: "Spot PR-shaped UK news coverage",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col font-sans antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              PR Monitor
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/browse" className="hover:underline">Browse</Link>
              <Link href="/trends" className="hover:underline">Trends</Link>
              <Link href="/config/feeds" className="hover:underline">Feeds</Link>
              <Link href="/config/patterns" className="hover:underline">Patterns</Link>
              <Link href="/config/blocklist" className="hover:underline">Blocklist</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto max-w-7xl w-full px-6 py-8">
          {children}
        </main>
        <footer className="border-t text-xs text-muted-foreground py-4 text-center">
          PR Campaign Monitor v1
        </footer>
      </body>
    </html>
  );
}
