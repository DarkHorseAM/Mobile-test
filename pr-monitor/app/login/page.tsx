import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from = "/", error } = await searchParams;

  async function submit(formData: FormData) {
    "use server";
    const password = (formData.get("password") ?? "").toString();
    const expected = process.env.SITE_PASSWORD;
    const target = (formData.get("from") ?? "/").toString();
    if (!expected || password !== expected) {
      redirect(`/login?error=1&from=${encodeURIComponent(target)}`);
    }
    const jar = await cookies();
    jar.set("site_auth", expected, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect(target.startsWith("/") ? target : "/");
  }

  return (
    <div className="mx-auto max-w-sm mt-24">
      <h1 className="text-xl font-semibold mb-1">PR Monitor</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter the team password to continue.</p>
      <form action={submit} className="space-y-3">
        <input type="hidden" name="from" value={from} />
        <input
          name="password"
          type="password"
          autoFocus
          required
          className="w-full rounded border px-3 py-2"
          placeholder="Password"
        />
        {error && <p className="text-sm text-red-600">Wrong password.</p>}
        <button
          type="submit"
          className="w-full rounded bg-black text-white py-2 text-sm font-medium"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
