import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const ok = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
const fail = (status: number, message = "nope") =>
  new Response(JSON.stringify({ error: { message } }), { status });

const schema = z.object({ v: z.number() });
// Runs the call while fast-forwarding the backoff sleeps, so retries take no real time.
const call = async () => {
  const { generateJson } = await import("@/lib/gemini");
  const p = generateJson({ system: "s", prompt: "p", schema, jsonSchema: {} });
  p.catch(() => {}); // rejection is asserted by the caller
  await vi.runAllTimersAsync();
  return p;
};
const keyOf = (url: string) => new URL(url).searchParams.get("key");

describe("generateJson key rotation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("GEMINI_API_KEYS", "k1,k2,k3");
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("passes the key as ?key= and returns parsed JSON", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => ok({ v: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).resolves.toEqual({ v: 1 });
    expect(keyOf(fetchMock.mock.calls[0][0])).toBe("k1");
  });

  it("rotates to the next key on 429 / 5xx", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok({ v: 2 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).resolves.toEqual({ v: 2 });
    expect(fetchMock.mock.calls.map((c) => keyOf(c[0] as string))).toEqual(["k1", "k2", "k3"]);
  });

  it("does not retry a non-retryable error", async () => {
    const fetchMock = vi.fn(async () => fail(400, "bad request"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).rejects.toThrow("bad request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries when the model returns JSON that fails the schema", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ v: "x" })).mockResolvedValueOnce(ok({ v: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).resolves.toEqual({ v: 3 });
  });

  it("gives up after two passes over all keys", async () => {
    const fetchMock = vi.fn(async () => fail(429, "quota"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).rejects.toThrow("quota");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
