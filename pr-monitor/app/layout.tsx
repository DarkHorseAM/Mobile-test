import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NavLinks } from "@/components/nav-links";

export const metadata: Metadata = {
  title: "PR Campaign Monitor",
  description: "Spot PR-shaped UK news coverage",
};

async function signOut() {
  "use server";
  const jar = await cookies();
  jar.delete("site_auth");
  redirect("/login");
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-paper text-ink font-mono antialiased">
        <div className="bg-ink text-paper">
          <div className="mx-auto max-w-7xl px-6 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[10px] font-sans font-medium uppercase tracking-label">
            <span>Dark Horse PR Tools</span>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href="https://pr-tools-launcher.vercel.app/"
                className="hover:text-accent transition-colors"
              >
                Tools home
              </a>
              <span className="text-accent" aria-current="page">
                PR Campaign Monitor
              </span>
              <a
                href="https://pr-tool-beta.vercel.app/"
                className="hover:text-accent transition-colors"
              >
                PR Index Builder
              </a>
              <a
                href="https://media-syndicate-pro.vercel.app/"
                className="hover:text-accent transition-colors"
              >
                Syndication Checker
              </a>
            </nav>
          </div>
        </div>

        <header className="bg-paper border-b border-rule">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/dark-horse-logo.png"
                alt="Dark Horse"
                width={89}
                height={28}
                priority
                className="h-7 w-auto"
              />
              <span className="font-sans font-medium text-sm tracking-tight">
                PR Campaign Monitor
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <NavLinks />
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-[11px] font-sans font-medium uppercase tracking-label text-ink hover:text-accent transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto max-w-7xl w-full px-6 py-10">
          {children}
        </main>

        <footer className="border-t border-rule">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-6 text-[11px] text-muted font-mono">
            <div className="flex items-center gap-2">
              <Image
                src="/dark-horse-logo.png"
                alt=""
                width={57}
                height={18}
                className="h-[18px] w-auto opacity-80"
              />
              <span>Built by Dark Horse</span>
            </div>
            <span className="text-right">
              Scans public RSS feeds. Coverage detection is pattern-based and may include false positives.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
