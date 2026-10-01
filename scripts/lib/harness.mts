// Shared helpers for smoke / seed / regression scripts. They talk to a running app over HTTP
// (exercising the real routes) and to Supabase with the service key for assertions.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export const BASE = process.env.APP_URL ?? "http://localhost:3000";

export const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

export async function http(path: string, init: RequestInit = {}) {
  return fetch(BASE + path, init);
}

export async function upload(file: string, role: string) {
  const body = new FormData();
  body.set("file", new Blob([readFileSync(file)]), file.split("/").pop()!);
  body.set("role", role);
  const res = await http("/api/candidates", { method: "POST", body });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as { id?: string; status?: string; error?: string } };
}

export async function syncAll(maxPasses = 30) {
  for (let i = 0; i < maxPasses; i++) {
    const res = await http("/api/sync", { method: "POST" });
    const json = (await res.json()) as { done: number; remaining: number; errors: string[]; error?: string };
    if (!res.ok) throw new Error(json.error ?? `sync HTTP ${res.status}`);
    if (json.errors?.length) console.log(`  sync errors: ${json.errors.join(" | ").slice(0, 300)}`);
    if (!json.remaining) return;
    if (json.done === 0) throw new Error(`sync stuck: ${json.errors?.[0]}`);
    process.stdout.write(`  drafting… ${json.remaining} left\n`);
  }
  throw new Error("sync did not converge");
}

export async function pool<T>(items: T[], size: number, fn: (t: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

let failures = 0;
export function check(ok: unknown, label: string, detail = "") {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
export function finish(name: string) {
  console.log(failures ? `\n${name}: ${failures} check(s) FAILED` : `\n${name}: all checks passed`);
  process.exit(failures ? 1 : 0);
}

export const sentences = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-Z"(])/).filter((s) => s.trim()).length;
