import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  geminiKeys: () =>
    required("GEMINI_API_KEYS")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  geminiModel: () => process.env.GEMINI_MODEL || "gemini-3.8-flash",
  resendKey: () => required("RESEND_API_KEY"),
  resendFrom: () => process.env.RESEND_FROM || "onboarding@resend.dev",
  /** When set, every email is delivered here instead of the candidate's own address. */
  testRecipient: () => (process.env.EMAIL_TEST_RECIPIENT || "").trim(),
  allowedEmailDomain: () => (process.env.EMAIL_ALLOWED_DOMAIN || "").toLowerCase(),
};
