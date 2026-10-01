import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { env } from "./env";

import type { Role } from "./ranking";

export { ROLES, SHORTLIST_SIZE, type Role } from "./ranking";

export type Criterion = {
  id: string;
  role: Role;
  position: number;
  name: string;
  description: string;
  source: string;
  weight: number;
};

let client: SupabaseClient | null = null;

/**
 * fetch that retries network failures (no HTTP response at all) up to 3 times. Only for requests that
 * are safe to repeat: everything except plain inserts, which could otherwise create duplicate rows.
 */
export const retryingFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? "GET").toUpperCase();
  const prefer = new Headers(init?.headers).get("prefer") ?? "";
  const repeatable = method !== "POST" || prefer.includes("resolution=merge-duplicates") || String(input).includes("/rpc/");
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (!repeatable || attempt >= 2 || init?.signal?.aborted) throw err;
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
};

// Service-role client. Server-only; RLS blocks every other key.
export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false },
    global: { fetch: retryingFetch },
  });
  return client;
}

/** Awaits a Supabase query and throws on error, so a failed write can never pass silently. */
export async function must<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/** Rubric rows; deduplicated per request with React cache. */
export const getRubric = cache(async function getRubric(): Promise<Criterion[]> {
  const { data, error } = await db()
    .from("rubric_criteria")
    .select("*")
    .order("role")
    .order("position");
  if (error) throw error;
  if (!data?.length) throw new Error("rubric_criteria is empty — run scripts/seed-rubric.mjs");
  return data as Criterion[];
});
