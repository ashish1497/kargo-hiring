import { afterEach, describe, expect, it, vi } from "vitest";
import { retryingFetch } from "@/lib/db";

const ok = () => new Response("[]", { status: 200 });
const netErr = () => Promise.reject(new TypeError("fetch failed"));

describe("retryingFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retries network failures on reads/updates", async () => {
    const f = vi.fn().mockImplementationOnce(netErr).mockImplementationOnce(netErr).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", f);
    await expect(retryingFetch("https://x/rest/v1/t", { method: "PATCH" })).resolves.toBeInstanceOf(Response);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("retries upserts (merge-duplicates)", async () => {
    const f = vi.fn().mockImplementationOnce(netErr).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", f);
    await retryingFetch("https://x/rest/v1/t", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" } });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("never retries a plain insert (could duplicate rows)", async () => {
    const f = vi.fn().mockImplementation(netErr);
    vi.stubGlobal("fetch", f);
    await expect(retryingFetch("https://x/rest/v1/t", { method: "POST" })).rejects.toThrow("fetch failed");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("does not retry HTTP error responses", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", f);
    expect((await retryingFetch("https://x/rest/v1/t")).status).toBe(500);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("gives up after 3 attempts", async () => {
    const f = vi.fn().mockImplementation(netErr);
    vi.stubGlobal("fetch", f);
    await expect(retryingFetch("https://x/rest/v1/t")).rejects.toThrow("fetch failed");
    expect(f).toHaveBeenCalledTimes(3);
  });
});
