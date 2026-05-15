"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/ui";

type ScanResult = {
  feedsScanned: number;
  articlesSeen: number;
  articlesNew: number;
  matchesNew: number;
  runId: number;
  errors: { feed: string; message: string }[];
};

export function RunScanButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const router = useRouter();

  async function runScan() {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowErrors(false);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Scan failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = JSON.parse(text) as ScanResult;
      setResult(data);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" onClick={runScan} disabled={loading}>
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner />
            Scanning…
          </span>
        ) : (
          "Run scan now"
        )}
      </Button>
      {result && (
        <div className="border border-rule bg-panel p-3 text-sm w-80 text-left font-mono">
          <div className="font-sans font-medium uppercase tracking-label text-[11px] text-muted">
            Scan complete
          </div>
          <div className="mt-1">
            {result.articlesNew} new article{result.articlesNew === 1 ? "" : "s"},{" "}
            {result.matchesNew} new match{result.matchesNew === 1 ? "" : "es"}
          </div>
          <div className="text-xs text-muted mt-1">
            {result.feedsScanned} feed{result.feedsScanned === 1 ? "" : "s"} scanned,{" "}
            {result.articlesSeen} article{result.articlesSeen === 1 ? "" : "s"} seen
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                className="text-[11px] font-sans font-medium uppercase tracking-label text-ink hover:text-accent"
                onClick={() => setShowErrors((s) => !s)}
              >
                {showErrors ? "Hide" : "Show"} {result.errors.length} feed error
                {result.errors.length === 1 ? "" : "s"}
              </button>
              {showErrors && (
                <ul className="mt-1 space-y-1 text-xs text-muted">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-sans font-medium uppercase tracking-label text-[10px] text-ink">
                        {e.feed}:
                      </span>{" "}
                      {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="border border-accent bg-panel p-3 text-sm w-80 text-left font-mono text-accent">
          {error}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
