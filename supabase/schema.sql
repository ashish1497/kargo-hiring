-- Kargo hiring dashboard schema. Idempotent: safe to re-run.

create table if not exists rubric_criteria (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in ('PM', 'SPM')),
  position    int  not null,
  name        text not null,
  description text not null,
  source      text not null default '',
  weight      int  not null check (weight between 0 and 100),
  unique (role, position)
);

create table if not exists candidates (
  id            uuid primary key default gen_random_uuid(),
  applied_role  text not null check (applied_role in ('PM', 'SPM')),
  file_name     text not null,
  file_path     text,
  -- Redacted CV text. The only CV-derived field any AI call ever sees.
  cv_content    text,
  -- One-line, name-free summary from the scoring call ("4y PM, freight SaaS; ex-3PL ops").
  headline      text,
  status        text not null default 'processing'
                check (status in ('processing', 'scored', 'failed')),
  error         text,
  created_at    timestamptz not null default now()
);

-- Personal details, split out at ingestion. Never read by AI code paths.
create table if not exists candidate_pii (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  name         text not null default '',
  email        text not null default '',
  phone        text not null default '',
  links        text[] not null default '{}',
  -- false when the extracted name could not be found verbatim in the CV text: check it by hand.
  name_confirmed boolean not null default true
);

create table if not exists scores (
  candidate_id uuid not null references candidates(id) on delete cascade,
  criterion_id uuid not null references rubric_criteria(id) on delete cascade,
  role         text not null check (role in ('PM', 'SPM')),
  score        int  not null check (score between 1 and 5),
  reason       text not null,
  primary key (candidate_id, criterion_id)
);

create table if not exists briefs (
  candidate_id uuid not null references candidates(id) on delete cascade,
  role         text not null check (role in ('PM', 'SPM')),
  text         text not null,
  created_at   timestamptz not null default now(),
  primary key (candidate_id, role)
);

create table if not exists emails (
  candidate_id  uuid primary key references candidates(id) on delete cascade,
  kind          text not null check (kind in ('invite', 'rejection')),
  subject       text not null,
  -- Uses {{first_name}}; the real name is substituted only at render/send time.
  body_template text not null,
  status        text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  error         text,
  resend_id     text,
  sent_to       text,
  sent_at       timestamptz,
  updated_at    timestamptz not null default now()
);

-- Weighted total per candidate per role, 0-100. Computed in SQL, never by the LLM.
create or replace view candidate_totals with (security_invoker = true) as
select
  s.candidate_id,
  s.role,
  round(sum(s.score::numeric / 5 * r.weight), 1) as total
from scores s
join rubric_criteria r on r.id = s.criterion_id
group by s.candidate_id, s.role;

-- Server uses the service-role key only. Lock everything else out.
alter table rubric_criteria enable row level security;
alter table candidates      enable row level security;
alter table candidate_pii   enable row level security;
alter table scores          enable row level security;
alter table briefs          enable row level security;
alter table emails          enable row level security;

-- Defence in depth: browser keys get nothing, even if a policy is added by mistake.
revoke all on rubric_criteria, candidates, candidate_pii, scores, briefs, emails, candidate_totals
  from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;
