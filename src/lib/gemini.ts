import "server-only";
import type { z } from "zod";
import { env } from "./env";

// REST, not the SDK: these keys must be passed as ?key= (the SDK sends a header they reject).
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

let cursor = 0;

class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function callOnce(key: string, body: unknown): Promise<string> {
  const res = await fetch(`${BASE}/${env.geminiModel()}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GeminiError(json?.error?.message ?? `HTTP ${res.status}`, res.status);
  const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new GeminiError(`Empty response (${json?.candidates?.[0]?.finishReason ?? "no candidates"})`, 502);
  return text;
}

/**
 * Structured JSON generation. Rotates through GEMINI_API_KEYS on quota/server errors and on
 * invalid JSON, up to two passes over all keys.
 */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
}): Promise<T> {
  const keys = env.geminiKeys();
  const attempts = keys.length * 2;
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: opts.jsonSchema,
    },
  };

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const key = keys[cursor % keys.length];
    try {
      const text = await callOnce(key, body);
      const parsed = opts.schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastError = new Error(`Schema mismatch: ${parsed.error.message.slice(0, 300)}`);
    } catch (err) {
      lastError = err;
      const retryable =
        !(err instanceof GeminiError) || RETRYABLE.has(err.status) || err instanceof SyntaxError;
      if (!retryable) throw err;
      cursor++; // rotate to the next key
    }
    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** i, 8_000)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
