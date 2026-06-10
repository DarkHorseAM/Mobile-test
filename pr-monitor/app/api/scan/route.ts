import { NextResponse } from "next/server";
import { runScan } from "@/lib/scanner/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  // A Bearer token bypasses the site-password middleware, so it must
  // match CRON_SECRET exactly — including when CRON_SECRET is unset.
  const isCron = authHeader.startsWith("Bearer ");
  if (isCron && (!expected || authHeader !== `Bearer ${expected}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runScan();
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return GET(req);
}
