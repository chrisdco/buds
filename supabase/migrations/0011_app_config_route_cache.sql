-- Phase 0 of the route view (docs/route-view.md section 13).
--
-- 1. app_config: settings we change without an app release (kill switches,
--    tuning). Anyone signed in may read; nobody writes through the API —
--    rows are edited from the dashboard / SQL. The app validates every value
--    and falls back to its own defaults, so a bad row can't break it.
-- 2. route_cache: routes shared across all users, written only by the
--    `route` Edge Function (service role). Convoy members ask for nearly the
--    same origin/destination, so one fetch serves the whole room. No RLS
--    policies on purpose: anon/authenticated get nothing.

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

create policy app_config_read on public.app_config
  for select to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.app_config from anon, authenticated;

create table if not exists public.route_cache (
  key text primary key,
  route jsonb not null,
  expires_at timestamptz not null
);

create index if not exists route_cache_expires_idx on public.route_cache (expires_at);

alter table public.route_cache enable row level security;

revoke all on public.route_cache from anon, authenticated;

-- Defaults the app also hard-codes; listed here so they are visible and
-- editable in one place.
insert into public.app_config (key, value) values
  ('routing', '{"proxy": true}'::jsonb)
on conflict (key) do nothing;
