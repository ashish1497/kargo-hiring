import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliveryAddress, firstName, recipientAllowed, renderBody } from "@/lib/mail";

describe("renderBody", () => {
  it("substitutes the real first name for every placeholder", () => {
    expect(renderBody("Hi {{first_name}},\nThanks {{ first_name }}.", "Priya Krishnan")).toBe("Hi Priya,\nThanks Priya.");
  });
  it("never leaves a placeholder behind", () => {
    expect(renderBody("Hi {{first_name}},", "")).toBe("Hi there,");
    expect(renderBody("Hi {{first_name}},", "  ")).not.toContain("{{");
  });
  it("firstName takes the first token", () => {
    expect(firstName("  Siddharth   Rao ")).toBe("Siddharth");
  });
});

describe("recipientAllowed", () => {
  const prev = process.env.EMAIL_ALLOWED_DOMAIN;
  beforeEach(() => vi.stubEnv("EMAIL_ALLOWED_DOMAIN", "pg27.mesaschool.co"));
  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.EMAIL_ALLOWED_DOMAIN = prev;
  });

  it("allows only the test domain", () => {
    expect(recipientAllowed("squad_1@pg27.mesaschool.co")).toBe(true);
    expect(recipientAllowed("SQUAD_1@PG27.MESASCHOOL.CO")).toBe(true);
    expect(recipientAllowed("rohan.desai.dev@gmail.com")).toBe(false);
    expect(recipientAllowed("x@evilpg27.mesaschool.co")).toBe(false);
    expect(recipientAllowed("x@pg27.mesaschool.co.evil.com")).toBe(false);
    expect(recipientAllowed("")).toBe(false);
  });
});

describe("deliveryAddress", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sends to the configured test inbox instead of the CV address", () => {
    vi.stubEnv("EMAIL_TEST_RECIPIENT", "ashish_bajaj@pg27.mesaschool.co");
    expect(deliveryAddress("squad_1@pg27.mesaschool.co")).toBe("ashish_bajaj@pg27.mesaschool.co");
    expect(deliveryAddress("")).toBe("ashish_bajaj@pg27.mesaschool.co");
  });
  it("falls back to the CV address when no test inbox is set", () => {
    vi.stubEnv("EMAIL_TEST_RECIPIENT", "");
    expect(deliveryAddress("squad_1@pg27.mesaschool.co")).toBe("squad_1@pg27.mesaschool.co");
  });
});
