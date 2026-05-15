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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">URL blocklist</h1>
        <p className="text-sm text-muted-foreground">
          Articles whose URL contains any active fragment are skipped at scan time and never written to the database.
          Match is case-insensitive substring.
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

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Fragment</th>
              <th className="p-3 w-32">Status</th>
              <th className="p-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={3}>
                  No fragments yet.
                </td>
              </tr>
            )}
            {rows.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="p-3 font-mono">{f.fragment}</td>
                <td className="p-3">{f.isActive ? "Active" : "Disabled"}</td>
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
      </Card>
    </div>
  );
}
