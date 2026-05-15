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
        {loading ? "Scanning…" : "Run scan now"}
      </Button>
      {result && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm w-80 text-left">
          <div className="font-medium">
            Scan complete — {result.articlesNew} new article
            {result.articlesNew === 1 ? "" : "s"}, {result.matchesNew} new match
            {result.matchesNew === 1 ? "" : "es"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {result.feedsScanned} feed{result.feedsScanned === 1 ? "" : "s"} scanned,{" "}
            {result.articlesSeen} article{result.articlesSeen === 1 ? "" : "s"} seen
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                className="text-xs underline"
                onClick={() => setShowErrors((s) => !s)}
              >
                {showErrors ? "Hide" : "Show"} {result.errors.length} feed error
                {result.errors.length === 1 ? "" : "s"}
              </button>
              {showErrors && (
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-medium">{e.feed}:</span> {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 w-80 text-left">
          {error}
        </div>
      )}
    </div>
  );
}
