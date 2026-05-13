import { db } from "@/lib/db/client";
import { patterns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Badge, Button, Card, Input, Label } from "@/components/ui/ui";

export const dynamic = "force-dynamic";

async function addPattern(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const regex = String(formData.get("regex") ?? "").trim();
  const kind = String(formData.get("kind") ?? "indicator").trim();
  if (!slug || !label || !regex) return;
  try {
    new RegExp(regex);
  } catch {
    return;
  }
  await db.insert(patterns).values({ slug, label, regex, kind }).onConflictDoNothing({ target: patterns.slug });
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

export default async function PatternsConfigPage() {
  const rows = await db.select().from(patterns).orderBy(patterns.kind, patterns.label);
  const indicators = rows.filter((r) => r.kind === "indicator");
  const brandExtractors = rows.filter((r) => r.kind === "brand");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Patterns</h1>
        <p className="text-sm text-muted-foreground">
          Regex applied to headline + summary. Indicators flag PR shape; brand extractors pull the source name from the first capture group.
        </p>
      </div>

      <Card>
        <form action={addPattern} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
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
          <div>
            <Label htmlFor="kind">Kind</Label>
            <select id="kind" name="kind" className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm">
              <option value="indicator">indicator</option>
              <option value="brand">brand</option>
            </select>
          </div>
          <div className="md:col-span-6">
            <Button type="submit">Add pattern</Button>
          </div>
        </form>
      </Card>

      <Section title="Indicators" rows={indicators} toggle={togglePattern} remove={deletePattern} />
      <Section title="Brand extractors" rows={brandExtractors} toggle={togglePattern} remove={deletePattern} />
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
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b font-semibold flex items-center gap-2">
        {title} <Badge>{rows.length}</Badge>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="p-3 w-44">Slug</th>
            <th className="p-3 w-60">Label</th>
            <th className="p-3">Regex</th>
            <th className="p-3 w-24">Status</th>
            <th className="p-3 w-40"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-3 font-mono text-xs">{p.slug}</td>
              <td className="p-3">{p.label}</td>
              <td className="p-3 font-mono text-xs text-muted-foreground truncate max-w-md">{p.regex}</td>
              <td className="p-3">{p.isActive ? "Active" : "Off"}</td>
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
    </Card>
  );
}
