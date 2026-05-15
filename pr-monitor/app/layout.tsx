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
