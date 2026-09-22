-- CareerQuest database schema for Supabase (Postgres).
-- Safe to run more than once. Every user table has row level security:
-- a signed in user can only ever read or write their own rows.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Profiles: one row per user, created automatically at sign up
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  location text,
  headline text,
  situation text check (situation in ('changer','laidoff','employed','returning')),
  prev_field text,
  target_field text,
  target_roles text[] not null default '{}',
  locations text[] not null default '{}',
  remote_pref text not null default 'any' check (remote_pref in ('any','remote','hybrid','onsite')),
  salary_floor integer,
  must_haves text[] not null default '{}',
  dealbreakers text[] not null default '{}',
  intensity text not null default 'active' check (intensity in ('casual','active','urgent')),
  legit_threshold integer not null default 40,
  notification_prefs jsonb not null default '{"dailyPlan":true,"newMatches":true,"ghostAlerts":true,"applicationUpdates":true,"weeklyCheckIn":true,"tips":false,"marketing":false}',
  onboarding_step integer not null default 0,
  onboarded_at timestamptz,
  -- billing (written by the server from Stripe webhooks only)
  plan_tier text not null default 'free' check (plan_tier in ('free','trial','pro')),
  billing_cycle text check (billing_cycle in ('monthly','yearly')),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Resumes and versions
-- ---------------------------------------------------------------
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text,               -- path in the private "resumes" storage bucket
  file_name text,
  mime_type text,
  parsed jsonb,                 -- structured resume: contact, summary, roles[], education, certifications, skills
  is_base boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  job_id text,
  name text not null,
  target text,
  content jsonb not null,       -- the final resume exactly as it would be sent
  changes jsonb,                -- Truth Mode changes with accept or reject decisions
  ats_score integer,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Jobs: shared cache of real listings pulled from job APIs.
-- Readable by any signed in user. Written only by the server.
-- ---------------------------------------------------------------
create table if not exists public.jobs (
  id text primary key,          -- "<source>:<external id>"
  source text not null,         -- adzuna | jsearch | greenhouse | lever | ashby
  external_id text not null,
  title text not null,
  company text not null,
  company_domain text,
  location text,
  remote_type text,             -- remote | hybrid | onsite | unknown
  salary_min integer,
  salary_max integer,
  salary_period text,
  description text,
  apply_url text,
  employer_posted boolean,      -- false when posted by a staffing agency
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  repost_count integer not null default 0,
  ats_provider text,            -- greenhouse | lever | ashby when found on the company's own board
  ats_board text,
  company_site_status text not null default 'unconfirmed' check (company_site_status in ('confirmed','unconfirmed','missing')),
  company_site_checked_at timestamptz,
  legit jsonb,                  -- { score, badge, factors[] }
  raw jsonb
);
create index if not exists jobs_title_idx on public.jobs using gin (to_tsvector('english', title || ' ' || company));
create index if not exists jobs_posted_idx on public.jobs (posted_at desc);

-- Per user match scores
create table if not exists public.job_matches (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  score integer not null,
  breakdown jsonb,              -- { experience, skills, industry, transferable }
  why text,
  gaps jsonb,
  translator jsonb,
  career_changer_friendly boolean,
  dismissed boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

-- ---------------------------------------------------------------
-- Applications, receipts, and timeline
-- ---------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete restrict,
  status text not null default 'saved' check (status in ('saved','applied','screening','interview','offer','closed')),
  method text check (method in ('submitted','prefilled','manual')),
  destination text check (destination in ('company','board')),
  destination_label text,
  submitted_at timestamptz,
  resume_version_id uuid references public.resume_versions(id) on delete set null,
  resume_snapshot jsonb,        -- exact resume sent, kept even if the version is deleted
  cover_letter text,
  fields jsonb,                 -- [{ q, a }] every form field and answer
  confirmation jsonb not null default '{"verified":false}',
  confirmation_file_path text,
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  note text,
  occurred_at timestamptz not null default now(),
  is_future boolean not null default false
);

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text references public.jobs(id) on delete set null,
  tone text,
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Momentum: plans, streaks, weekly targets, roadmap, practice
-- ---------------------------------------------------------------
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  for_date date not null default current_date,
  title text not null,
  detail text,
  minutes integer,
  link text,
  kind text,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

create table if not exists public.weekly_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  applications integer, networking integer, learning_hours integer,
  feeling text,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create table if not exists public.roadmap_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id text not null,
  gap_id text,
  status text not null check (status in ('started','done')),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text,
  question text,
  answer text,
  feedback jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Copilot chat
-- ---------------------------------------------------------------
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Insider connections (imported by the user from their own contacts)
-- ---------------------------------------------------------------
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  title text,
  company text,
  reason_type text,
  reason text,
  draft text,
  status text not null default 'none',
  last_touch_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Usage metering for free plan limits
-- ---------------------------------------------------------------
create table if not exists public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  tailored_resumes integer not null default 0,
  cover_letters integer not null default 0,
  copilot_messages integer not null default 0,
  primary key (user_id, month)
);

-- ---------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Billing and staff columns may only be changed by the server.
--
-- A column level REVOKE is not enough on its own: Supabase grants these roles
-- UPDATE on the whole table, and a table wide grant supersedes the column one,
-- so the revoke below is silently ignored. Revoke the table grant first, then
-- hand back only the columns a person is allowed to edit.
revoke update on public.profiles from authenticated, anon;
grant update (
  full_name, location, headline, situation, prev_field, target_field, target_roles, locations,
  remote_pref, max_distance_miles, salary_floor, must_haves, dealbreakers, intensity,
  legit_threshold, notification_prefs, onboarding_step, onboarded_at, updated_at
) on public.profiles to authenticated;

alter table public.jobs enable row level security;
drop policy if exists "jobs readable" on public.jobs;
create policy "jobs readable" on public.jobs for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['resumes','resume_versions','job_matches','applications','application_events','cover_letters',
    'plan_items','activity_days','weekly_targets','roadmap_progress','practice_attempts','chats','chat_messages','connections']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Usage counters are read only for users. The server increments them.
alter table public.usage_counters enable row level security;
drop policy if exists "own usage read" on public.usage_counters;
create policy "own usage read" on public.usage_counters for select using (user_id = auth.uid());

-- ---------------------------------------------------------------
-- Private storage for resume files and confirmation screenshots.
-- Files live under a folder named after the user's id.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('confirmations', 'confirmations', false) on conflict (id) do nothing;

drop policy if exists "own files read" on storage.objects;
create policy "own files read" on storage.objects for select to authenticated
  using (bucket_id in ('resumes','confirmations') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own files write" on storage.objects;
create policy "own files write" on storage.objects for insert to authenticated
  with check (bucket_id in ('resumes','confirmations') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own files delete" on storage.objects;
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('resumes','confirmations') and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------
-- App state: plan progress, chats, letters, saved applications and other
-- per-user working data. One row per user. (Applications and receipts move
-- into their own tables in a later stage.)
-- ---------------------------------------------------------------
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
drop policy if exists "own rows" on public.user_state;
create policy "own rows" on public.user_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- Admin layer. Staff accounts that can see the whole service.
-- is_admin is set by the server only: the ADMIN_EMAILS environment
-- variable promotes an account the first time it signs in, and an
-- existing admin can promote another account from the admin panel.
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- is_admin is covered by the column grants above and by the trigger below.

-- Every action an admin takes that changes or removes someone's data is written here.
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_id text,
  target_label text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

-- Row level security with no policy at all: only the service role, which the
-- admin API uses, can read or write the log. No browser session can touch it.
alter table public.admin_actions enable row level security;

-- ---------------------------------------------------------------
-- Commute radius. "Locations" alone could not say how far someone
-- is willing to travel from where they actually live.
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists max_distance_miles integer not null default 30;

-- ---------------------------------------------------------------
-- Paid add-ons bought on top of a plan, for example Insider
-- Connections. Written by the server from Stripe webhooks only.
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists add_ons jsonb not null default '{}';

-- ---------------------------------------------------------------
-- One saved resume version per job, so re-saving updates in place
-- rather than piling up duplicates.
-- ---------------------------------------------------------------
-- These are plain rather than partial indexes: Postgres can only use a partial
-- index for ON CONFLICT when the statement repeats its predicate, which an
-- upsert from PostgREST does not do. Null job_ids stay distinct either way.
drop index if exists resume_versions_user_job_idx;
drop index if exists cover_letters_user_job_idx;
create unique index if not exists resume_versions_user_job_uidx on public.resume_versions (user_id, job_id);
create unique index if not exists cover_letters_user_job_uidx on public.cover_letters (user_id, job_id);

-- ---------------------------------------------------------------
-- Backstop for the columns above. Grants are easy to widen by
-- accident, so this refuses the change itself no matter how the
-- update arrives. Only the service role, which our server uses,
-- may touch what decides staff access or what someone has paid for.
-- ---------------------------------------------------------------
create or replace function public.guard_profile_columns() returns trigger
language plpgsql as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.is_admin is distinct from old.is_admin
     or new.plan_tier is distinct from old.plan_tier
     or new.billing_cycle is distinct from old.billing_cycle
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.subscription_status is distinct from old.subscription_status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.current_period_end is distinct from old.current_period_end
     or new.cancel_at_period_end is distinct from old.cancel_at_period_end
     or new.add_ons is distinct from old.add_ons
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Only CareerQuest can change that field.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_columns on public.profiles;
create trigger guard_profile_columns before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- ---------------------------------------------------------------
-- Where a listing sits, and where the person lives. Together these
-- turn the commute radius into a real filter instead of a number
-- that was collected and never used.
-- ---------------------------------------------------------------
alter table public.jobs add column if not exists latitude double precision;
alter table public.jobs add column if not exists longitude double precision;
alter table public.profiles add column if not exists home_lat double precision;
alter table public.profiles add column if not exists home_lng double precision;
-- The home base string those coordinates belong to, so moving re-runs the lookup.
alter table public.profiles add column if not exists home_geocoded_for text;

-- ---------------------------------------------------------------
-- Daily allowance per person, per kind of work. Every endpoint that
-- spends money (Anthropic, Adzuna) takes from this before it runs.
-- The take is one atomic statement, so two requests arriving at once
-- cannot both slip under the limit.
-- ---------------------------------------------------------------
create table if not exists public.api_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  bucket text not null,
  n integer not null default 0,
  primary key (user_id, day, bucket)
);
alter table public.api_usage enable row level security;
-- No policy on purpose: only the service role, which the server uses, touches this.

create or replace function public.take_quota(p_user uuid, p_bucket text, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare taken integer;
begin
  insert into public.api_usage as u (user_id, day, bucket, n)
  values (p_user, (now() at time zone 'utc')::date, p_bucket, 1)
  on conflict (user_id, day, bucket)
  do update set n = u.n + 1 where u.n < p_limit
  returning u.n into taken;
  return taken is not null;
end $$;

revoke all on function public.take_quota(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.take_quota(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------
-- The terms a posting asks for, read once and kept. Shared like the
-- rest of the job cache: it describes the posting, not any person.
-- ---------------------------------------------------------------
alter table public.jobs add column if not exists keywords jsonb;

-- ---------------------------------------------------------------
-- Phase 2: jobs a person adds themselves, and two more statuses.
-- ---------------------------------------------------------------

-- A job someone pastes in belongs to them alone. The shared cache stays shared
-- (owner_id is null); an imported job is visible only to its owner.
alter table public.jobs add column if not exists owner_id uuid references auth.users(id) on delete cascade;
create index if not exists jobs_owner_idx on public.jobs (owner_id) where owner_id is not null;

drop policy if exists "jobs readable" on public.jobs;
create policy "jobs readable" on public.jobs for select to authenticated
  using (owner_id is null or owner_id = auth.uid());

-- "Closed" lumped rejections in with withdrawals and silence. They are different
-- outcomes, and rejections are the number people most want to see.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.applications'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.applications drop constraint %I', c);
  end loop;
  alter table public.applications add constraint applications_status_check
    check (status in ('saved','applied','screening','interview','offer','rejected','withdrawn','closed'));
end $$;
-- Anything already stored as closed is a withdrawal or silence unless a rejection was logged.
update public.applications a set status = 'rejected'
  where a.status = 'closed' and exists (select 1 from public.application_events e where e.application_id = a.id and e.type = 'rejected');
update public.applications set status = 'withdrawn' where status = 'closed';

-- ---------------------------------------------------------------
-- Matches: when each one was first shown to the person, how far it is
-- from the nearest place they named, and a cache of place lookups.
-- ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'job_matches' and column_name = 'first_shown_at') then
    alter table public.job_matches add column first_shown_at timestamptz not null default now();
    -- Matches that already exist were first shown when they were first scored.
    update public.job_matches set first_shown_at = computed_at;
  end if;
end $$;
create index if not exists job_matches_shown_idx on public.job_matches (user_id, first_shown_at desc);
alter table public.job_matches add column if not exists distance_miles integer;

-- Every place the person said they would work, with coordinates, so distance can be measured from the nearest one.
alter table public.profiles add column if not exists anchors jsonb not null default '[]';

-- "City, ST" to coordinates. Written only by our server.
create table if not exists public.geo_cache (
  place text primary key,
  lat double precision,
  lng double precision,
  found boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.geo_cache enable row level security;
revoke all on public.geo_cache from anon, authenticated;

-- ---------------------------------------------------------------
-- A match that has been shown to someone stays theirs. `kept` is set the
-- first time a listing passes the match rules for that person, and after
-- that no later rule change can take it away. Everything that already
-- existed when this was added counts as shown.
-- ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'job_matches' and column_name = 'kept') then
    alter table public.job_matches add column kept boolean not null default false;
    update public.job_matches set kept = true;
  end if;
end $$;

-- ---------------------------------------------------------------
-- LinkedIn search through Apify. A switch that staff can flip without a
-- deploy, and a record of every run so spend and daily limits are enforced
-- from real numbers. Both are written and read only by our server.
-- ---------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('linkedin_enabled', 'false') on conflict (key) do nothing;

create table if not exists public.linkedin_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id text not null unique,
  status text not null default 'running',
  items integer,
  cost_usd numeric,
  ids jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists linkedin_runs_started_idx on public.linkedin_runs (started_at desc);
alter table public.linkedin_runs enable row level security;
revoke all on public.linkedin_runs from anon, authenticated;

-- ---------------------------------------------------------------
-- Guests. A visitor who starts setting up gets a temporary account
-- (Supabase anonymous sign in). When they sign up, that same account
-- gets an email and password, so nothing has to be moved.
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists is_guest boolean not null default false;
alter table public.profiles add column if not exists salary_ceiling integer;
alter table public.profiles add column if not exists target_other text;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, is_guest)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.is_anonymous, false))
  on conflict (id) do nothing;
  return new;
end $$;

-- Keeps the profile in step when a guest becomes a member, or a member changes their email.
create or replace function public.sync_user_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set email = new.email,
         is_guest = coalesce(new.is_anonymous, false),
         full_name = case when coalesce(full_name, '') = '' then coalesce(new.raw_user_meta_data->>'full_name', '') else full_name end
   where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email, is_anonymous, raw_user_meta_data on auth.users
  for each row execute function public.sync_user_identity();

-- A person cannot decide for themselves that they are or are not a guest.
create or replace function public.guard_profile_columns() returns trigger
language plpgsql as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.is_admin is distinct from old.is_admin
     or new.plan_tier is distinct from old.plan_tier
     or new.billing_cycle is distinct from old.billing_cycle
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.subscription_status is distinct from old.subscription_status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.current_period_end is distinct from old.current_period_end
     or new.cancel_at_period_end is distinct from old.cancel_at_period_end
     or new.add_ons is distinct from old.add_ons
     or new.is_guest is distinct from old.is_guest
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Only CareerQuest can change that field.' using errcode = '42501';
  end if;
  return new;
end $$;

-- Guests who never signed up are removed after a week, with everything they made.
create or replace function public.delete_stale_guests(days integer default 7) returns integer
language plpgsql security definer set search_path = public, auth as $$
declare n integer;
begin
  with gone as (
    delete from auth.users u using public.profiles p
     where p.id = u.id and p.is_guest and u.created_at < now() - make_interval(days => days)
    returning u.id
  )
  select count(*) into n from gone;
  return n;
end $$;
revoke all on function public.delete_stale_guests(integer) from public, anon, authenticated;
grant execute on function public.delete_stale_guests(integer) to service_role;

-- ---------------------------------------------------------------
-- What people do with listings, so recommendations can learn from it.
-- A person who opens, saves or applies to something we did not rank as
-- a match is telling us something. Rows are private to their owner.
-- ---------------------------------------------------------------
create table if not exists public.match_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  kind text not null check (kind in ('open', 'save', 'apply', 'dismiss', 'checkfit')),
  was_match boolean not null default false,
  score_then integer,
  created_at timestamptz not null default now()
);
create index if not exists match_signals_user_idx on public.match_signals (user_id, created_at desc);
alter table public.match_signals enable row level security;
drop policy if exists "own rows" on public.match_signals;
create policy "own rows" on public.match_signals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- A person may set their own confirmed home point and the new
-- preference fields. Billing, staff and guest columns stay server-only.
-- ---------------------------------------------------------------
grant update (home_lat, home_lng, home_geocoded_for, anchors, salary_ceiling, target_other) on public.profiles to authenticated;
