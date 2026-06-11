-- Buds core schema: rooms, members, destinations.
-- Locations are NOT stored per-tick; room_members carries a low-frequency
-- last-known snapshot used only for late-join / reconnect recovery.

create table public.rooms (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  name           text not null check (char_length(name) between 1 and 60),
  mode           text not null default 'solo'
                 check (mode in ('solo','converge','multitrack','leader','formation')),
  host_id        uuid not null,
  leader_id      uuid,
  traveler_limit int  not null default 10 check (traveler_limit between 1 and 10),
  locked         boolean not null default false,
  status         text not null default 'active' check (status in ('active','ended')),
  -- per-mode knobs: formation_radius_m, separation_alert_m, arrival_radius_m,
  -- min_send_interval_ms (remote throttle floor) ...
  settings       jsonb not null default '{}'::jsonb,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  ended_at       timestamptz
);

-- Codes are unique among ACTIVE rooms only, so they recycle after a room ends.
create unique index rooms_code_active_uidx on public.rooms (code) where status = 'active';
create index rooms_expiry_idx on public.rooms (expires_at) where status = 'active';

create table public.room_members (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms (id) on delete cascade,
  user_id       uuid not null,
  display_name  text not null check (char_length(display_name) between 1 and 24),
  role          text not null default 'traveler' check (role in ('traveler','spectator')),
  sharing       boolean not null default true,
  arrived_at    timestamptz,
  -- recovery snapshot, upserted at most every ~60s by update_last_seen():
  last_lat      double precision,
  last_lng      double precision,
  last_heading  real,
  last_speed    real,
  last_seen_at  timestamptz,
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,
  kicked        boolean not null default false,
  unique (room_id, user_id)
);

create index room_members_room_idx on public.room_members (room_id) where left_at is null;

create table public.destinations (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  member_id   uuid references public.room_members (id) on delete cascade,
              -- null => room-level destination (converge / host-set)
  label       text not null default 'Destination',
  lat         double precision not null,
  lng         double precision not null,
  created_by  uuid not null,
  created_at  timestamptz not null default now(),
  unique nulls not distinct (room_id, member_id)
);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so RLS policies can use them without recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from room_members m
    where m.room_id = p_room_id
      and m.user_id = (select auth.uid())
      and m.left_at is null
  );
$$;

-- Parses a realtime topic of the form 'room:<uuid>' and checks membership.
create or replace function public.is_room_topic_member(p_topic text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if p_topic not like 'room:%' then
    return false;
  end if;
  begin
    v_room_id := substring(p_topic from 6)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.is_room_member(v_room_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security: members can read their room's rows; ALL writes go
-- through SECURITY DEFINER RPCs (0002), so no insert/update/delete policies.
-- ---------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.destinations enable row level security;

create policy rooms_member_select on public.rooms
  for select to authenticated
  using (public.is_room_member(id));

create policy room_members_member_select on public.room_members
  for select to authenticated
  using (public.is_room_member(room_id));

create policy destinations_member_select on public.destinations
  for select to authenticated
  using (public.is_room_member(room_id));

revoke insert, update, delete on public.rooms, public.room_members, public.destinations
  from anon, authenticated;
