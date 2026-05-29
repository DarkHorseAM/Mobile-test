import { NextResponse } from "next/server";
import { resetBylineAttempts } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST() {
  const requeued = await resetBylineAttempts();
  return NextResponse.json({ requeued });
}
