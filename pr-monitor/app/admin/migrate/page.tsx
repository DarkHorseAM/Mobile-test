import { runMigration, type MigrationStep } from "@/lib/db/migrate";
import { Button, Card } from "@/components/ui/ui";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STORE: { last: MigrationStep[] | null } = { last: null };

async function apply() {
  "use server";
  STORE.last = await runMigration();
  revalidatePath("/admin/migrate");
  redirect("/admin/migrate");
}

export default function MigratePage() {
  const steps = STORE.last;
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Database Migration</h1>
        <p className="mt-1 text-sm text-muted">
          One-time database setup steps. Adds the url_blocklist table with sport
          defaults, deactivates retired patterns, and drops the unused
          confidence_score column. All steps are idempotent — safe to re-run.
        </p>
      </div>

      <Card>
        <form action={apply}>
          <Button type="submit">Apply pending migrations</Button>
        </form>
      </Card>

      {steps && (
        <Card>
          <h2 className="text-[11px] font-sans font-medium uppercase tracking-label text-muted mb-3">Last run</h2>
          <ul className="space-y-2 text-sm">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={
                    "inline-block min-w-12 text-[10px] font-sans font-medium uppercase tracking-label px-2 py-0.5 border " +
                    (s.ok
                      ? "border-rule text-ink bg-panel"
                      : "border-accent text-accent bg-panel")
                  }
                >
                  {s.ok ? "OK" : "ERR"}
                </span>
                <div className="flex-1">
                  <div>{s.step}</div>
                  {s.error && (
                    <div className="text-xs text-accent mt-1">{s.error}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted mt-4">
            All steps OK?{" "}
            <Link href="/browse" className="hover:text-accent hover:underline">
              Go to Browse
            </Link>{" "}
            and run a scan.
          </p>
        </Card>
      )}
    </div>
  );
}
