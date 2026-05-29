import { NextResponse } from "next/server";
import {
  countArticlesNeedingByline,
  listArticlesNeedingByline,
  updateArticleByline,
} from "@/lib/db/queries";
import { fetchByline } from "@/lib/scanner/extract-byline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 25;

export async function POST() {
  const started = Date.now();
  const todo = await listArticlesNeedingByline(BATCH_SIZE);

  if (todo.length === 0) {
    return NextResponse.json({
      processed: 0,
      withByline: 0,
      noByline: 0,
      errored: 0,
      remaining: 0,
      durationMs: 0,
      samples: [],
      failuresByOutlet: [],
    });
  }

  const results = await Promise.all(
    todo.map(async (a) => {
      const res = await fetchByline(a.url);
      return { article: a, res };
    }),
  );

  let withByline = 0;
  let noByline = 0;
  let errored = 0;
  const samples: { outlet: string; byline: string | null; error: string | null }[] = [];
  const failuresMap = new Map<string, { count: number; message: string }>();

  for (const { article, res } of results) {
    if (res.ok) {
      await updateArticleByline(article.id, res.byline);
      if (res.byline) {
        withByline += 1;
        if (samples.length < 8) {
          samples.push({ outlet: article.outlet, byline: res.byline, error: null });
        }
      } else {
        noByline += 1;
      }
    } else {
      errored += 1;
      const prev = failuresMap.get(article.outlet);
      failuresMap.set(article.outlet, {
        count: (prev?.count ?? 0) + 1,
        message: res.error,
      });
      if (samples.length < 8) {
        samples.push({ outlet: article.outlet, byline: null, error: res.error });
      }
    }
  }

  const failuresByOutlet = [...failuresMap.entries()]
    .map(([outlet, info]) => ({ outlet, count: info.count, message: info.message }))
    .sort((a, b) => b.count - a.count);

  const remaining = await countArticlesNeedingByline();

  return NextResponse.json({
    processed: results.length,
    withByline,
    noByline,
    errored,
    remaining,
    durationMs: Date.now() - started,
    samples,
    failuresByOutlet,
  });
}
