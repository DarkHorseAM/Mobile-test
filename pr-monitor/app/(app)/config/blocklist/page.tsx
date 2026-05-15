import { db } from "@/lib/db/client";
import { urlBlocklist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Button, Card, Input, Label } from "@/components/ui/ui";

export const dynamic = "force-dynamic";

async function addFragment(formData: FormData) {
  "use server";
  const fragment = String(formData.get("fragment") ?? "").trim();
  if (!fragment) return;
  await db
    .insert(urlBlocklist)
    .values({ fragment })
    .onConflictDoNothing({ target: urlBlocklist.fragment });
  revalidatePath("/config/blocklist");
}

async function toggleFragment(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  await db.update(urlBlocklist).set({ isActive: !isActive }).where(eq(urlBlocklist.id, id));
  revalidatePath("/config/blocklist");
}

async function deleteFragment(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  await db.delete(urlBlocklist).where(eq(urlBlocklist.id, id));
  revalidatePath("/config/blocklist");
}

export default async function BlocklistConfigPage() {
  const rows = await db.select().from(urlBlocklist).orderBy(urlBlocklist.fragment);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">URL Blocklist</h1>
        <p className="mt-1 text-sm text-muted">
          Articles whose URL contains any active fragment are skipped at scan time and never written to the database. Match is case-insensitive substring.
        </p>
      </div>

      <Card>
        <form action={addFragment} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-3">
            <Label htmlFor="fragment">URL fragment</Label>
            <Input id="fragment" name="fragment" required placeholder="/sport/" />
          </div>
          <div>
            <Button type="submit">Add fragment</Button>
          </div>
        </form>
      </Card>

      <div className="bg-panel border border-rule overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead className="border-b border-rule">
            <tr className="text-left">
              <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Fragment</th>
              <th className="p-3 w-32 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Status</th>
              <th className="p-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-8 text-center text-muted" colSpan={3}>
                  <span className="font-display text-xl text-ink">nothing blocked yet</span>
                </td>
              </tr>
            )}
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-rule hover:bg-paper transition-colors">
                <td className="p-3">{f.fragment}</td>
                <td className="p-3">
                  <span
                    className={
                      "text-[10px] font-sans font-medium uppercase tracking-label " +
                      (f.isActive ? "text-ink" : "text-muted")
                    }
                  >
                    {f.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="p-3 flex gap-2">
                  <form action={toggleFragment}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="isActive" value={String(f.isActive)} />
                    <Button type="submit" variant="outline">
                      {f.isActive ? "Disable" : "Enable"}
                    </Button>
                  </form>
                  <form action={deleteFragment}>
                    <input type="hidden" name="id" value={f.id} />
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
    </div>
  );
}
