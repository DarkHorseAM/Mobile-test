import { db } from "@/lib/db/client";
import { feeds } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Button, Card, Input, Label } from "@/components/ui/ui";

export const dynamic = "force-dynamic";

async function addFeed(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const tier = String(formData.get("tier") ?? "").trim() || null;
  if (!name || !url) return;
  await db.insert(feeds).values({ name, url, tier }).onConflictDoNothing({ target: feeds.url });
  revalidatePath("/config/feeds");
}

async function toggleFeed(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  await db.update(feeds).set({ isActive: !isActive }).where(eq(feeds.id, id));
  revalidatePath("/config/feeds");
}

async function deleteFeed(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  await db.delete(feeds).where(eq(feeds.id, id));
  revalidatePath("/config/feeds");
}

export default async function FeedsConfigPage() {
  const rows = await db.select().from(feeds).orderBy(feeds.name);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Manage Feeds</h1>
        <p className="mt-1 text-sm text-muted">RSS sources scanned every morning at 7am UTC.</p>
      </div>

      <Card>
        <form action={addFeed} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="url">RSS URL</Label>
            <Input id="url" name="url" required type="url" placeholder="https://..." />
          </div>
          <div>
            <Label htmlFor="tier">Tier (optional)</Label>
            <Input id="tier" name="tier" placeholder="tabloid / broadsheet / ..." />
          </div>
          <div className="md:col-span-4">
            <Button type="submit">Add feed</Button>
          </div>
        </form>
      </Card>

      <div className="bg-panel border border-rule overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead className="border-b border-rule">
            <tr className="text-left">
              <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Name</th>
              <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">URL</th>
              <th className="p-3 w-28 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Tier</th>
              <th className="p-3 w-32 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Status</th>
              <th className="p-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-rule hover:bg-paper transition-colors">
                <td className="p-3">{f.name}</td>
                <td className="p-3 text-muted truncate max-w-xs">
                  <a href={f.url} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
                    {f.url}
                  </a>
                </td>
                <td className="p-3 text-muted">{f.tier ?? "—"}</td>
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
                  <form action={toggleFeed}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="isActive" value={String(f.isActive)} />
                    <Button type="submit" variant="outline">
                      {f.isActive ? "Disable" : "Enable"}
                    </Button>
                  </form>
                  <form action={deleteFeed}>
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
