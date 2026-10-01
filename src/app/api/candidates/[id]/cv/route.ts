import { NextResponse } from "next/server";
import { db, must } from "@/lib/db";

// Original CV: signed on click (10 min) instead of on every candidate page render.
export async function GET(_req: Request, ctx: RouteContext<"/api/candidates/[id]/cv">) {
  const { id } = await ctx.params;
  const cand = await must(db().from("candidates").select("file_path").eq("id", id).maybeSingle());
  if (!cand?.file_path) return NextResponse.json({ error: "No stored CV" }, { status: 404 });
  const { data, error } = await db().storage.from("cvs").createSignedUrl(cand.file_path, 600);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not sign URL" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
