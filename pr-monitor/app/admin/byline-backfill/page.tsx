import { countArticlesNeedingByline } from "@/lib/db/queries";
import { BylineBackfillRunner } from "@/components/byline-backfill-runner";

export const dynamic = "force-dynamic";

export default async function BylineBackfillPage() {
  const remaining = await countArticlesNeedingByline();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Byline backfill</h1>
        <p className="mt-1 text-sm text-muted">
          Fetches the HTML of articles missing a byline and extracts the
          author from JSON-LD or <code className="text-xs">&lt;meta name=&quot;author&quot;&gt;</code>.
          Processes 25 articles per batch, with a 1.5s pause between
          batches to stay polite. Click <strong>Run all</strong> to drain
          the queue automatically — you can <strong>Stop</strong> at any
          point. Articles where the byline isn&apos;t findable get their
          byline set to NULL permanently and are excluded from future
          batches.
        </p>
      </div>

      <BylineBackfillRunner initialRemaining={remaining} />
    </div>
  );
}
