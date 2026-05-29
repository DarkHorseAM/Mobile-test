"use client";

import { useState } from "react";
import { Button } from "@/components/ui/ui";

type Sample = {
  outlet: string;
  url: string;
  byline: string | null;
  error: string | null;
  htmlExcerpt: string | null;
};

type BatchResponse = {
  processed: number;
  withByline: number;
  noByline: number;
  errored: number;
  remaining: number;
  durationMs: number;
  samples: Sample[];
  failuresByOutlet: { outlet: string; count: number; message: string }[];
};

type DebugResponse = {
  url: string;
  result:
    | {
        ok: true;
        byline: string | null;
        source: "meta" | "jsonld" | null;
        htmlExcerpt: string | null;
        httpStatus: number;
        bytes: number;
      }
    | { ok: false; error: string };
};

const PAUSE_BETWEEN_BATCHES_MS = 1500;

export function BylineBackfillRunner({ initialRemaining }: { initialRemaining: number }) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [running, setRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [totals, setTotals] = useState({
    processed: 0,
    withByline: 0,
    noByline: 0,
    errored: 0,
    batches: 0,
  });
  const [lastBatch, setLastBatch] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState("");
  const [debugResult, setDebugResult] = useState<DebugResponse | null>(null);
  const [debugRunning, setDebugRunning] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function runOne(): Promise<BatchResponse | null> {
    try {
      const res = await fetch("/api/byline-backfill", { method: "POST" });
      if (!res.ok) {
        setError(`Batch failed: HTTP ${res.status}`);
        return null;
      }
      return (await res.json()) as BatchResponse;
    } catch (e) {
      setError(`Batch failed: ${(e as Error).message}`);
      return null;
    }
  }

  async function runLoop() {
    setRunning(true);
    setStopRequested(false);
    setError(null);
    setTotals({ processed: 0, withByline: 0, noByline: 0, errored: 0, batches: 0 });

    let halted = false;
    while (!halted) {
      const batch = await runOne();
      if (!batch) {
        halted = true;
        break;
      }
      setLastBatch(batch);
      setRemaining(batch.remaining);
      setTotals((t) => ({
        processed: t.processed + batch.processed,
        withByline: t.withByline + batch.withByline,
        noByline: t.noByline + batch.noByline,
        errored: t.errored + batch.errored,
        batches: t.batches + 1,
      }));
      if (batch.remaining === 0 || batch.processed === 0) {
        halted = true;
        break;
      }
      // Read latest stop state via functional update side-channel
      let shouldStop = false;
      setStopRequested((s) => {
        shouldStop = s;
        return s;
      });
      if (shouldStop) {
        halted = true;
        break;
      }
      await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_BATCHES_MS));
    }
    setRunning(false);
  }

  async function resetAttempts() {
    if (!confirm("Re-queue all articles that previously came back with no byline? Articles where you've already captured a byline are not affected.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/byline-backfill/reset", { method: "POST" });
      const data = (await res.json()) as { requeued: number };
      setRemaining((r) => r + data.requeued);
    } catch (e) {
      setError(`Reset failed: ${(e as Error).message}`);
    }
    setResetting(false);
  }

  async function runDebug() {
    if (!debugUrl.trim()) return;
    setDebugRunning(true);
    setDebugResult(null);
    try {
      const res = await fetch(`/api/byline-debug?url=${encodeURIComponent(debugUrl.trim())}`);
      const data = (await res.json()) as DebugResponse;
      setDebugResult(data);
    } catch (e) {
      setError(`Debug probe failed: ${(e as Error).message}`);
    }
    setDebugRunning(false);
  }

  async function runSingle() {
    setRunning(true);
    setError(null);
    const batch = await runOne();
    if (batch) {
      setLastBatch(batch);
      setRemaining(batch.remaining);
      setTotals((t) => ({
        processed: t.processed + batch.processed,
        withByline: t.withByline + batch.withByline,
        noByline: t.noByline + batch.noByline,
        errored: t.errored + batch.errored,
        batches: t.batches + 1,
      }));
    }
    setRunning(false);
  }

  const done = remaining === 0;

  return (
    <div className="space-y-6">
      <div className="bg-panel border border-rule p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-sans font-medium uppercase tracking-label text-muted">
            Remaining
          </div>
          <div className="text-2xl font-sans font-bold tabular-nums mt-1">
            {remaining.toLocaleString()}
          </div>
        </div>
        <div className="flex gap-2">
          {running ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStopRequested(true)}
              disabled={stopRequested}
            >
              {stopRequested ? "Stopping after this batch…" : "Stop"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={resetAttempts}
                disabled={resetting}
              >
                {resetting ? "Resetting…" : "Reset failed attempts"}
              </Button>
              <Button type="button" variant="outline" onClick={runSingle} disabled={done}>
                {done ? "All done" : "Run one batch"}
              </Button>
              <Button type="button" onClick={runLoop} disabled={done}>
                {done ? "All done" : "Run all"}
              </Button>
            </>
          )}
        </div>
      </div>

      {(running || totals.batches > 0) && (
        <div className="bg-panel border border-rule overflow-hidden">
          <div className="px-5 py-3 border-b border-rule text-[11px] font-sans font-medium uppercase tracking-label text-muted flex items-center justify-between">
            <span>
              {running ? "Running" : "Run summary"} · {totals.batches} batch
              {totals.batches === 1 ? "" : "es"}
            </span>
            {running && (
              <span className="text-accent normal-case tracking-normal text-xs font-mono">
                {lastBatch?.processed ? `last batch ${(lastBatch.durationMs / 1000).toFixed(1)}s` : "fetching…"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 divide-x divide-rule">
            <Stat label="Processed" value={totals.processed} />
            <Stat label="Byline found" value={totals.withByline} accent />
            <Stat label="No byline" value={totals.noByline} />
            <Stat label="Errored" value={totals.errored} />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-panel border border-accent p-4 text-sm text-accent">{error}</div>
      )}

      {lastBatch && lastBatch.samples.length > 0 && (
        <div className="bg-panel border border-rule overflow-hidden">
          <div className="px-5 py-3 border-b border-rule text-[11px] font-sans font-medium uppercase tracking-label text-muted">
            Latest batch sample
          </div>
          <ul className="divide-y divide-rule text-sm">
            {lastBatch.samples.map((s, i) => (
              <li key={i} className="px-5 py-2 space-y-2">
                <div className="flex items-baseline justify-between gap-4 font-mono">
                  <span className="font-sans font-medium text-xs">{s.outlet}</span>
                  {s.byline ? (
                    <span className="text-ink">{s.byline}</span>
                  ) : s.error ? (
                    <span className="text-accent text-xs">{s.error}</span>
                  ) : (
                    <span className="text-muted text-xs">no byline in page</span>
                  )}
                </div>
                {s.htmlExcerpt && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-accent text-[10px] font-sans font-medium uppercase tracking-label">
                      Show meta tags + JSON-LD found
                    </summary>
                    <pre className="mt-2 p-3 bg-paper border border-rule text-[11px] font-mono whitespace-pre-wrap break-all max-h-96 overflow-auto">
                      {s.htmlExcerpt}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-panel border border-rule overflow-hidden">
        <div className="px-5 py-3 border-b border-rule text-[11px] font-sans font-medium uppercase tracking-label text-muted">
          Probe a single URL
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={debugUrl}
              onChange={(e) => setDebugUrl(e.target.value)}
              placeholder="https://www.example.com/article/..."
              className="flex-1 h-9 bg-panel border border-rule px-3 text-sm font-mono text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <Button type="button" onClick={runDebug} disabled={debugRunning || !debugUrl.trim()}>
              {debugRunning ? "Fetching…" : "Probe"}
            </Button>
          </div>
          {debugResult && (
            <div className="text-sm space-y-2">
              {!debugResult.result.ok ? (
                <div className="text-accent font-mono text-xs">Error: {debugResult.result.error}</div>
              ) : (
                <>
                  <div className="font-mono text-xs text-muted">
                    HTTP {debugResult.result.httpStatus} · {debugResult.result.bytes.toLocaleString()} bytes
                  </div>
                  <div>
                    <span className="text-[11px] font-sans font-medium uppercase tracking-label text-muted mr-2">Byline</span>
                    {debugResult.result.byline ? (
                      <span className="font-mono">{debugResult.result.byline}</span>
                    ) : (
                      <span className="text-muted">not found</span>
                    )}
                    {debugResult.result.source && (
                      <span className="ml-2 text-[10px] font-sans font-medium uppercase tracking-label text-accent">
                        from {debugResult.result.source}
                      </span>
                    )}
                  </div>
                  {debugResult.result.htmlExcerpt && (
                    <details className="text-xs" open>
                      <summary className="cursor-pointer text-accent text-[10px] font-sans font-medium uppercase tracking-label">
                        Meta tags + JSON-LD found ({debugResult.result.htmlExcerpt.length} chars)
                      </summary>
                      <pre className="mt-2 p-3 bg-paper border border-rule text-[11px] font-mono whitespace-pre-wrap break-all max-h-[32rem] overflow-auto">
                        {debugResult.result.htmlExcerpt}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {lastBatch && lastBatch.failuresByOutlet.length > 0 && (
        <div className="bg-panel border border-rule overflow-hidden">
          <div className="px-5 py-3 border-b border-rule text-[11px] font-sans font-medium uppercase tracking-label text-muted">
            Failing outlets in latest batch
          </div>
          <ul className="divide-y divide-rule text-sm">
            {lastBatch.failuresByOutlet.map((f) => (
              <li key={f.outlet} className="px-5 py-2 flex items-baseline justify-between gap-4">
                <span className="font-sans font-medium">{f.outlet}</span>
                <span className="flex items-baseline gap-3 text-xs">
                  <span className="text-muted">{f.message}</span>
                  <span className="tabular-nums text-accent font-sans font-medium uppercase tracking-label text-[10px]">
                    {f.count}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="p-4">
      <div className="text-[11px] font-sans font-medium uppercase tracking-label text-muted">
        {label}
      </div>
      <div
        className={
          "text-2xl font-sans font-bold tabular-nums mt-1 " +
          (accent ? "text-accent" : "text-ink")
        }
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
