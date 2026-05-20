import { db } from "@/lib/db/client";
import { patterns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Badge, Button, Card, Input, Label } from "@/components/ui/ui";

export const dynamic = "force-dynamic";

// Reject regex shapes that are known to cause catastrophic backtracking
// (ReDoS). Conservative heuristic — catches the common footguns; not a
// formal proof of safety.
function isUnsafeRegex(source: string): boolean {
  if (source.length > 300) return true;
  // Nested quantifiers — the classic backtracking trap, e.g. (a+)+ , (a*)*
  if (/\([^)]*[+*][^)]*\)[+*?]/.test(source)) return true;
  // Quantified alternation that can overlap, e.g. (a|a)+ , (a|ab)*
  if (/\([^)]*\|[^)]*\)[+*]/.test(source)) return true;
  return false;
}

async function addPattern(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const regex = String(formData.get("regex") ?? "").trim();
  if (!slug || !label || !regex) return;
  try {
    new RegExp(regex);
  } catch {
    redirect("/config/patterns?error=invalid_regex");
  }
  if (isUnsafeRegex(regex)) {
    redirect("/config/patterns?error=unsafe_regex");
  }
  await db
    .insert(patterns)
    .values({ slug, label, regex, kind: "indicator" })
    .onConflictDoNothing({ target: patterns.slug });
  revalidatePath("/config/patterns");
}

async function togglePattern(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  await db.update(patterns).set({ isActive: !isActive }).where(eq(patterns.id, id));
  revalidatePath("/config/patterns");
}

async function deletePattern(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  await db.delete(patterns).where(eq(patterns.id, id));
  revalidatePath("/config/patterns");
}

export default async function PatternsConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const indicators = await db
    .select()
    .from(patterns)
    .where(eq(patterns.kind, "indicator"))
    .orderBy(patterns.label);

  const errorMessage =
    error === "invalid_regex"
      ? "That regex couldn't be parsed."
      : error === "unsafe_regex"
        ? "That regex was rejected as potentially unsafe (nested quantifiers or overlapping alternation can cause catastrophic backtracking and lock up the scanner). Rewrite it without nested + or * inside a group."
        : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Patterns</h1>
        <p className="mt-1 text-sm text-muted">
          Regex applied to each article&apos;s headline + summary. A hit on any
          pattern flags the article as PR-shaped and stores it.
        </p>
      </div>

      {errorMessage && (
        <div className="border border-accent bg-panel p-3 text-sm text-accent">
          {errorMessage}
        </div>
      )}

      <Card>
        <form action={addPattern} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" required placeholder="ranked_top_n" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" required placeholder="Top N list" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="regex">Regex</Label>
            <Input id="regex" name="regex" required placeholder="\\btop \\d{1,3}\\b" />
          </div>
          <div className="md:col-span-5">
            <Button type="submit">Add pattern</Button>
          </div>
        </form>
      </Card>

      <Section title="Indicators" rows={indicators} toggle={togglePattern} remove={deletePattern} />
    </div>
  );
}

function Section({
  title,
  rows,
  toggle,
  remove,
}: {
  title: string;
  rows: { id: number; slug: string; label: string; regex: string; kind: string; isActive: boolean }[];
  toggle: (fd: FormData) => Promise<void>;
  remove: (fd: FormData) => Promise<void>;
}) {
  return (
    <div className="bg-panel border border-rule overflow-hidden">
      <div className="px-4 py-3 border-b border-rule flex items-center gap-3">
        <span className="text-[11px] font-sans font-medium uppercase tracking-label text-ink">{title}</span>
        <Badge>{rows.length}</Badge>
      </div>
      <table className="w-full text-sm font-mono">
        <thead className="border-b border-rule">
          <tr className="text-left">
            <th className="p-3 w-44 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Slug</th>
            <th className="p-3 w-60 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Label</th>
            <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Regex</th>
            <th className="p-3 w-24 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Status</th>
            <th className="p-3 w-40"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-rule hover:bg-paper transition-colors">
              <td className="p-3 text-xs">{p.slug}</td>
              <td className="p-3">{p.label}</td>
              <td className="p-3 text-xs text-muted truncate max-w-md">{p.regex}</td>
              <td className="p-3">
                <span
                  className={
                    "text-[10px] font-sans font-medium uppercase tracking-label " +
                    (p.isActive ? "text-ink" : "text-muted")
                  }
                >
                  {p.isActive ? "Active" : "Off"}
                </span>
              </td>
              <td className="p-3 flex gap-2">
                <form action={toggle}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="isActive" value={String(p.isActive)} />
                  <Button type="submit" variant="outline">
                    {p.isActive ? "Disable" : "Enable"}
                  </Button>
                </form>
                <form action={remove}>
                  <input type="hidden" name="id" value={p.id} />
                  <Button type="submit" variant="ghost">
                    Delete
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
