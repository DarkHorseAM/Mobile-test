import { NextResponse } from "next/server";
import { runScan } from "@/lib/scanner/run";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;

  // Two ways in: Vercel Cron's Bearer token, or an authenticated user clicking
  // "Run scan now" from the UI.
  const isCron = expected && authHeader === `Bearer ${expected}`;
  let isUser = false;
  if (!isCron) {
    const session = await auth();
    isUser = Boolean(session?.user);
  }
  if (!isCron && !isUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runScan();
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return GET(req);
}
