import { NextResponse } from "next/server";
import { processCandidate } from "@/lib/pipeline";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: RouteContext<"/api/candidates/[id]/retry">) {
  const { id } = await ctx.params;
  try {
    await processCandidate(id);
    return NextResponse.json({ id, status: "scored" });
  } catch (e) {
    return NextResponse.json({ id, status: "failed", error: (e as Error).message }, { status: 422 });
  }
}
