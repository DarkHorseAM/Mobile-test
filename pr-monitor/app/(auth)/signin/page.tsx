import { signIn } from "@/lib/auth";
import { Button, Card, Input, Label } from "@/components/ui/ui";

export const dynamic = "force-dynamic";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  return <SignInForm searchParams={searchParams} />;
}

async function SignInForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const hasResend = Boolean(process.env.AUTH_RESEND_KEY);
  const hasGoogle = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="max-w-sm mx-auto mt-12">
      <Card className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Team-only access — your email must be on the allowlist.
          </p>
        </div>

        {sp.error && (
          <div className="text-sm rounded border border-red-200 bg-red-50 text-red-700 p-2">
            {sp.error === "AccessDenied"
              ? "Your email isn't on the allowlist."
              : `Sign-in error: ${sp.error}`}
          </div>
        )}

        {hasResend && (
          <form
            action={async (formData) => {
              "use server";
              await signIn("resend", {
                email: formData.get("email"),
                redirectTo: "/trends",
              });
            }}
            className="space-y-2"
          >
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@yourteam.com" />
            <Button type="submit" className="w-full">Send magic link</Button>
          </form>
        )}

        {hasGoogle && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/trends" });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
        )}

        {!hasResend && !hasGoogle && (
          <div className="text-sm text-muted-foreground">
            No auth providers are configured. Set <code>AUTH_RESEND_KEY</code> or{" "}
            <code>AUTH_GOOGLE_ID/SECRET</code> in your environment.
          </div>
        )}
      </Card>
    </div>
  );
}
