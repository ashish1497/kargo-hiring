# Kargo Hiring Dashboard — Build Plan

Source: MESA Case 02 problem statement, Arjun deck, execution-plan solution key, `rubric.txt`.

## Goal
Ranked shortlist per role (PM, SPM) with enough reasoning per candidate that Arjun decides in under 10 minutes.
The system recommends; Arjun decides. Nothing is sent without his click.

## The Cut
No auto-reject, no auto-send (checks 06 + 09). Automated: extraction, scoring, ranking, brief, email draft.
Human: shortlist review, confirm-to-send, hiring call.

## Stack
Next.js (App Router) · Supabase (Postgres + Storage) · Gemini Flash (`@google/genai`, 3 keys rotated on error) ·
Resend · Vercel · GitHub.

## Pipeline (per uploaded CV)
1. **Upload** — PDF/DOCX + applied role (PM/SPM). File → Supabase Storage.
2. **Parse** — `unpdf` (PDF) / `mammoth` (DOCX) → raw text.
3. **PII split (deterministic, no AI)** — regex for email, phone, LinkedIn/GitHub URLs; name from the
   header line / filename. Store in `candidate_pii`. Redact every occurrence (incl. name tokens) from the text →
   `cv_content`. Verify: redacted text contains none of the PII strings; else fail loudly.
   (The solution key lists Gemini for PII extraction; deterministic extraction is used instead so personal
   details never reach any AI call — matches the Data Privacy Block.)
4. **Score** — one Gemini call on `cv_content` with both rubrics from the DB → JSON (Zod-validated):
   per role, per criterion `{score 1–5, reason}`. Weighted total computed in code, not by the LLM.
5. **Rank** — per role, order by total. Top 5 per role (by applied role) = "above the line".
6. **Brief** — top 5 per role: 3-sentence interview brief (who, why ranked here, what to probe).
7. **Email draft** — every candidate: invite (above line) or warm rejection (below), written from CV content
   with `{{name}}` placeholder; real name substituted server-side at render/send time.
8. **Confirm & send** — Arjun clicks Confirm → Resend to the email in `candidate_pii` (MESA test addresses,
   `@pg27.mesaschool.co`). Hard allowlist on that domain; anything else is blocked. Mark `sent_at`, `status`.

Re-ranking: when a new CV pushes someone into/out of the top 5, briefs and draft types are regenerated for
anyone whose line position changed (only if not yet sent).

## Data model (Supabase)
- `rubric_criteria` — id, role (PM|SPM), position, name, description, weight. Seeded from `rubric.txt`.
- `candidates` — id, applied_role, file_path, cv_content (redacted), status (processing|scored|failed),
  error, created_at.
- `candidate_pii` — candidate_id (PK/FK), name, email, phone, links. Never read by AI code paths.
- `scores` — candidate_id, role, criterion_id, score, reason. Plus `candidate_totals` view (role, total, rank).
- `briefs` — candidate_id, role, text.
- `emails` — candidate_id, kind (invite|rejection), subject, body_template, status (draft|sent|failed),
  sent_at, resend_id, confirmed_by.

## Pages
- `/` — upload (file(s) + role select). Bulk upload allowed for the 60.
- `/dashboard` — tabs PM / SPM: ranked table (rank, name, total, per-criterion mini-bars, applied role,
  line marker after #5, email status). Cross-role flag ("scores higher on SPM").
- `/candidates/[id]` — score breakdown with reasons (both roles), brief, editable email draft, Confirm & Send.

## Gemini key rotation
`GEMINI_API_KEYS` (comma-separated). On 429/5xx/quota error → next key; exponential backoff; give up after
all keys × 2 attempts → candidate `status=failed` with retry button.

## Privacy
- Billed Gemini key (free tier may train on inputs).
- `seed/` and `.env.local` gitignored. `01–30` CVs are real cohort members who never applied.
- RLS: no anon access to `candidate_pii`; server-only service-role access.

## Build order & checkpoints
1. Scaffold project, Supabase schema + seed rubric → **L4-2 done**: deployed upload page, rubric rows exist.
2. Parse + PII split + scoring + brief + email draft → test 3 CVs (strong PM `pm_01_priya_krishnan`,
   weak SPM, ambiguous) → upload all 60 → **B-1 done**.
3. Resend Confirm wiring with allowlist → **B-2 done**.
4. End-to-end: 2 new CVs, upload → send < 5 min → **B-3 done**. Push.

## Sanity checks on the ranking
- `pm_01_priya_krishnan`, `spm_16_siddharth_rao` should rank high (ops floor time + kills + sole owner).
- Credential-heavy cohort CVs (`01–30`) should mostly fall below the line.
- A Vikram-like CV (polished, no ops time, only wins) must not reach the top 5.
