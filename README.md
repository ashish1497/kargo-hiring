# Kargo Hiring Dashboard

Internal tool for Arjun (founder, Kargo). Upload CVs → personal details split off → scored against the
PM and SPM rubrics in `rubric.txt` (derived from Kargo's past hires, not the JDs) → ranked shortlist per
role with a 3-sentence interview brief for the top 5 and a draft email for everyone. **Nothing is sent until
Arjun clicks Confirm & send.**

See `PLAN.md` for the design and `rubric.txt` for the rubric and the hire evidence behind each criterion.

## Pipeline
| Step | Where | Notes |
| --- | --- | --- |
| Upload CV + applied role | `/` → `POST /api/candidates` | PDF/DOCX ≤ 4 MB; role chosen per batch (PM or SPM) |
| Parse | `src/lib/parse.ts` | unpdf / mammoth; strips control chars |
| Split personal details | `src/lib/pii.ts` | Deterministic (no AI). Name/email/phone/links → `candidate_pii`; redacted text → `candidates.cv_content`. Fails the CV if anything leaks |
| Score both rubrics | `src/lib/pipeline.ts` | One Gemini call, 1–5 + reason per criterion. Totals computed in SQL (`candidate_totals`) |
| Rank, brief, drafts | `POST /api/sync` | Top 5 per applied role → brief + invite; others → rejection. Batched; client loops until `remaining: 0`. Never touches sent emails |
| Review + send | `/roles/PM`, `/roles/SPM`, `/candidates/[id]` | Edit draft, Confirm & send via Resend. Recipient must be on `EMAIL_ALLOWED_DOMAIN` |

## Setup
```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:schema            # applies supabase/schema.sql (idempotent; needs psql)
npm run seed:rubric          # loads rubric.txt into rubric_criteria
npm run dev
```

`SUPABASE_DB_URL` must use the **session pooler** (`aws-0-<region>.pooler.supabase.com:5432`, user
`postgres.<project-ref>`); the direct `db.<ref>.supabase.co` host is IPv6-only. It is only needed for
`db:schema`, not at runtime.

Gemini keys go in `GEMINI_API_KEYS` (comma-separated; rotated on 429/5xx). They are sent as `?key=`,
so the REST API is called directly rather than through the SDK. Use billed keys: the free tier may use
inputs for training.

## Deploy (Vercel)
Import the repo, set every variable from `.env.example` **except** `SUPABASE_DB_URL`, deploy.
`.env.local` and `seed/` (real people's CVs) are gitignored.

## Tests
| Command | What | Needs |
| --- | --- | --- |
| `npm test` | Unit tests: PII split (incl. all 68 seed CVs), ranking, rubric file, prompts, Gemini key rotation, mail guard, pipeline failure paths | nothing (seed CVs optional) |
| `npm run smoke` | Checkpoint B-1 on 3 CVs through the live API + DB: validation, privacy split, totals = weighted sum, briefs, drafts, pages, send guard. Cleans up after itself | `npm run dev` |
| `npm run seed:cvs` | Uploads all of `seed/resumes` through the API, then drafts. Skips CVs already scored | `npm run dev` |
| `npm run regression` | Full pool: 60 scored, 5 + 5 above the line with briefs/invites, rejections below, no PII leaks, ranking sanity, drift vs last run (`seed/.regression-snapshot.json`) | seeded DB |
| `npm run typecheck`, `npm run lint`, `npm run build` | | |

## Email sending
Resend's default sender (`onboarding@resend.dev`) only delivers to the address that owns the Resend
account. Other recipients are rejected by Resend; the app shows the error and marks the draft `failed`
(it can be retried). Sends are idempotent per draft version, and a send is claimed (`sending`) before the
API call so a double click cannot send twice.
