import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";

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
    // Only same-site paths: "//host" and "/\host" are protocol-relative
    // redirects off-site.
    redirect(/^\/(?![/\\])/.test(target) ? target : "/");
  }

  return (
    <div className="mx-auto max-w-sm mt-16">
      <div className="bg-panel border border-rule p-8">
        <Image
          src="/dark-horse-logo.png"
          alt="Dark Horse"
          width={89}
          height={28}
          priority
          className="h-7 w-auto mb-6"
        />
        <h1 className="font-sans font-bold text-2xl tracking-tight">PR Campaign Monitor</h1>
        <p className="mt-1 text-sm text-muted">Enter the team password to continue.</p>
        <form action={submit} className="mt-6 space-y-3">
          <input type="hidden" name="from" value={from} />
          <div>
            <label
              htmlFor="password"
              className="block mb-1 text-[11px] font-sans font-medium uppercase tracking-label text-muted"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
              className="w-full h-9 bg-panel border border-rule px-3 text-sm font-mono text-ink focus:border-accent focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-sm text-accent font-mono">Wrong password.</p>
          )}
          <button
            type="submit"
            className="w-full py-2 text-xs font-sans font-medium uppercase tracking-label bg-accent text-white border border-accent hover:bg-accent-hover hover:border-accent-hover transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
