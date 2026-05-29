import { NextResponse } from "next/server";
import { fetchByline } from "@/lib/scanner/extract-byline";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });
  const result = await fetchByline(url);
  return NextResponse.json({ url, result });
}
