import { NextResponse } from "next/server";
import { syncDrafts } from "@/lib/pipeline";

export const maxDuration = 300;

// Regenerates briefs/drafts to match the current ranking, in bounded batches. Call until remaining = 0.
export async function POST() {
  try {
    return NextResponse.json(await syncDrafts());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
