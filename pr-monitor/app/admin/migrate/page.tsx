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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Database migration</h1>
        <p className="text-sm text-muted-foreground">
          One-time setup for the refinement pass: adds the confidence_score column,
          creates the url_blocklist table with sport defaults, and deactivates the
          retired Season hook pattern. All steps are idempotent — safe to re-run.
        </p>
      </div>

      <Card>
        <form action={apply}>
          <Button type="submit">Apply pending migrations</Button>
        </form>
      </Card>

      {steps && (
        <Card>
          <h2 className="font-medium mb-3">Last run</h2>
          <ul className="space-y-2 text-sm">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={
                    "inline-block min-w-12 text-xs font-mono px-2 py-0.5 rounded " +
                    (s.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")
                  }
                >
                  {s.ok ? "OK" : "ERR"}
                </span>
                <div className="flex-1">
                  <div>{s.step}</div>
                  {s.error && (
                    <div className="text-xs text-red-700 font-mono mt-1">{s.error}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-4">
            All steps OK?{" "}
            <Link href="/browse" className="underline">
              Go to Browse
            </Link>{" "}
            and run a scan.
          </p>
        </Card>
      )}
    </div>
  );
}
