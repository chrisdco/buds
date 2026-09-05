-- P0 stability hardening: capacity race, host abandonment, typed-error holes,
-- expiry incoherence, geo validation.
-- All changes are CREATE OR REPLACE / IF NOT EXISTS / guarded ALTERs, so this
-- applies cleanly on top of 0001..0006 on fresh hosted stacks and local resets.
--
-- New typed error codes (see 0002 header + RpcError in src/types/contracts.ts):
--   bad_name, bad_display_name, bad_limit, bad_expiry, bad_destination

-- ---------------------------------------------------------------------------
-- 1. generate_room_code: pin search_path + revoke direct client execution.
-- Clients never need to call it (create_room runs as definer); revoking
-- removes an unauthenticated-code-oracle surface.
-- ---------------------------------------------------------------------------
create or replace function public.generate_room_code()
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  -- no confusables: I, L, O, 0, 1
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from rooms r where r.code = v_code and r.status = 'active'
    );
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.generate_room_code() from authenticated;

-- ---------------------------------------------------------------------------
-- 2. create_room: typed validation + code-collision retry (unique_violation
-- previously surfaced as a 500 instead of a typed result).
-- ---------------------------------------------------------------------------
create or replace function public.create_room(
  p_name text,
  p_display_name text,
  p_mode text default 'solo',
  p_traveler_limit int default 10,
  p_expires_at timestamptz default null,
  p_settings jsonb default '{}'::jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room rooms;
  v_member room_members;
  v_name text;
  v_display_name text;
  v_limit int;
  v_attempt int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_mode not in ('solo','converge','multitrack','leader','formation') then
    return jsonb_build_object('ok', false, 'error', 'bad_mode');
  end if;

  v_name := trim(p_name);
  if v_name is null or v_name = '' or char_length(v_name) > 60 then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;
  v_display_name := trim(p_display_name);
  if v_display_name is null or v_display_name = '' or char_length(v_display_name) > 24 then
    return jsonb_build_object('ok', false, 'error', 'bad_display_name');
  end if;
  v_limit := coalesce(p_traveler_limit, 10);
  if v_limit < 1 or v_limit > 10 then
    return jsonb_build_object('ok', false, 'error', 'bad_limit');
  end if;
  if p_expires_at is not null and p_expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'bad_expiry');
  end if;

  -- The 729M code space makes a clash ~impossible, but concurrent creates can
  -- still collide on rooms_code_active_uidx — retry with a fresh code.
  for v_attempt in 1..5 loop
    begin
      insert into rooms (code, name, mode, host_id, leader_id, traveler_limit, expires_at, settings)
      values (
        generate_room_code(),
        v_name,
        p_mode,
        v_uid,
        case when p_mode = 'leader' then v_uid end,
        v_limit,
        p_expires_at,
        coalesce(p_settings, '{}'::jsonb)
      )
      returning * into v_room;
      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        return jsonb_build_object('ok', false, 'error', 'bad_code');
      end if;
    end;
  end loop;

  insert into room_members (room_id, user_id, display_name, role)
  values (v_room.id, v_uid, v_display_name, 'traveler')
  returning * into v_member;

  return jsonb_build_object('ok', true, 'room', to_jsonb(v_room), 'member', to_jsonb(v_member));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. join_room: FOR UPDATE capacity lock + lock lets prior members rejoin +
-- typed display-name validation.
-- ---------------------------------------------------------------------------
create or replace function public.join_room(
  p_code text,
  p_display_name text,
  p_role text default 'traveler'
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_display_name text;
  v_room rooms;
  v_member room_members;
  v_existing boolean;
  v_travelers int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_role not in ('traveler','spectator') then
    return jsonb_build_object('ok', false, 'error', 'bad_role');
  end if;

  v_code := upper(trim(p_code));
  if v_code is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;

  -- Row lock serializes concurrent joins so the capacity check below can't
  -- oversell traveler_limit.
  select * into v_room
  from rooms
  where code = v_code and status = 'active'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  if v_room.expires_at is not null and v_room.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'room_ended');
  end if;

  select * into v_member
  from room_members
  where room_id = v_room.id and user_id = v_uid;
  -- capture now: any later SELECT INTO would clobber FOUND
  v_existing := found;

  if v_existing and v_member.kicked then
    return jsonb_build_object('ok', false, 'error', 'kicked');
  end if;

  -- already an active member: idempotent rejoin
  if v_existing and v_member.left_at is null then
    return jsonb_build_object('ok', true, 'room', to_jsonb(v_room), 'member', to_jsonb(v_member));
  end if;

  -- A lock blocks strangers, not prior members rejoining after a disconnect.
  if v_room.locked and not v_existing then
    return jsonb_build_object('ok', false, 'error', 'room_locked');
  end if;

  v_display_name := trim(p_display_name);
  if v_display_name is null or v_display_name = '' or char_length(v_display_name) > 24 then
    return jsonb_build_object('ok', false, 'error', 'bad_display_name');
  end if;

  if p_role = 'traveler' then
    select count(*) into v_travelers
    from room_members
    where room_id = v_room.id and role = 'traveler' and left_at is null;
    if v_travelers >= v_room.traveler_limit then
      return jsonb_build_object('ok', false, 'error', 'room_full');
    end if;
  end if;

  if v_existing then
    update room_members
    set left_at = null,
        role = p_role,
        display_name = v_display_name,
        arrived_at = null,
        joined_at = now()
    where id = v_member.id
    returning * into v_member;
  else
    insert into room_members (room_id, user_id, display_name, role)
    values (v_room.id, v_uid, v_display_name, p_role)
    returning * into v_member;
  end if;

  return jsonb_build_object('ok', true, 'room', to_jsonb(v_room), 'member', to_jsonb(v_member));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. leave_room: auto-promote the oldest active traveler (else oldest active
-- member) when the host leaves, and fall the leader back to the host, so a
-- room is never stranded unmanageable. Approved default: auto-promote.
-- ---------------------------------------------------------------------------
create or replace function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_leaver room_members;
  v_room rooms;
  v_successor uuid;
  v_host_active boolean;
begin
  update room_members
  set left_at = now()
  where room_id = p_room_id and user_id = v_uid and left_at is null
  returning * into v_leaver;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  select * into v_room from rooms where id = p_room_id;
  if found then
    select m.user_id into v_successor
    from room_members m
    where m.room_id = p_room_id and m.left_at is null and m.user_id <> v_uid
    order by case when m.role = 'traveler' then 0 else 1 end, m.joined_at asc
    limit 1;

    if v_room.host_id = v_uid and v_successor is not null then
      update rooms
      set host_id = v_successor,
          leader_id = case when leader_id = v_uid then v_successor else leader_id end
      where id = p_room_id;
    elsif v_room.leader_id = v_uid then
      select exists (
        select 1 from room_members
        where room_id = p_room_id and user_id = v_room.host_id and left_at is null
      ) into v_host_active;
      update rooms
      set leader_id = case
        when v_host_active then v_room.host_id
        when v_successor is not null then v_successor
        else leader_id
      end
      where id = p_room_id;
    end if;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. set_leader: host check FIRST so strangers can't oracle whether an
-- arbitrary user_id is an active traveler (not_member vs not_host).
-- ---------------------------------------------------------------------------
create or replace function public.set_leader(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1 from rooms
    where id = p_room_id and host_id = v_uid and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  if not exists (
    select 1 from room_members
    where room_id = p_room_id and user_id = p_user_id
      and role = 'traveler' and left_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  update rooms
  set leader_id = p_user_id
  where id = p_room_id and host_id = v_uid and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. set_expiry: reject past dates and immortal rooms (>30d); NULL still
-- clears the limit (used by "Remove limit").
-- ---------------------------------------------------------------------------
create or replace function public.set_expiry(p_room_id uuid, p_expires_at timestamptz)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_expires_at is not null then
    if p_expires_at < now() then
      return jsonb_build_object('ok', false, 'error', 'bad_expiry');
    end if;
    if p_expires_at > now() + interval '30 days' then
      return jsonb_build_object('ok', false, 'error', 'bad_expiry');
    end if;
  end if;
  update rooms
  set expires_at = p_expires_at
  where id = p_room_id and host_id = v_uid and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. set_destination: geo range validation + 80-char label cap (prevents
-- poisoned snapshots for late joiners and broadcast bloat).
-- ---------------------------------------------------------------------------
create or replace function public.set_destination(
  p_room_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_label text default 'Destination',
  p_member_id uuid default null   -- null => room-level destination (host only)
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room rooms;
  v_member room_members;
  v_dest destinations;
begin
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('ok', false, 'error', 'bad_destination');
  end if;
  select * into v_room from rooms where id = p_room_id and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'room_ended');
  end if;
  if not is_room_member(p_room_id) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  if p_member_id is null then
    if v_room.host_id <> v_uid then
      return jsonb_build_object('ok', false, 'error', 'not_host');
    end if;
  else
    select * into v_member
    from room_members
    where id = p_member_id and room_id = p_room_id and left_at is null;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'not_member');
    end if;
    if v_member.user_id <> v_uid and v_room.host_id <> v_uid then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  insert into destinations (room_id, member_id, label, lat, lng, created_by)
  values (p_room_id, p_member_id, left(coalesce(nullif(trim(p_label), ''), 'Destination'), 80), p_lat, p_lng, v_uid)
  on conflict (room_id, member_id)
  do update set lat = excluded.lat,
                lng = excluded.lng,
                label = excluded.label,
                created_by = excluded.created_by,
                created_at = now()
  returning * into v_dest;

  return jsonb_build_object('ok', true, 'destination', to_jsonb(v_dest));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. clear_destination: only active members' destinations (matches set_).
-- ---------------------------------------------------------------------------
create or replace function public.clear_destination(
  p_room_id uuid,
  p_member_id uuid default null
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room rooms;
  v_member room_members;
begin
  select * into v_room from rooms where id = p_room_id and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'room_ended');
  end if;

  if p_member_id is null then
    if v_room.host_id <> v_uid then
      return jsonb_build_object('ok', false, 'error', 'not_host');
    end if;
  else
    select * into v_member
    from room_members
    where id = p_member_id and room_id = p_room_id and left_at is null;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'not_member');
    end if;
    if v_member.user_id <> v_uid and v_room.host_id <> v_uid then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  delete from destinations
  where room_id = p_room_id and member_id is not distinct from p_member_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. update_last_seen: also honors expires_at (closes the 5-min post-expiry
-- ghost where join said room_ended but the HTTPS lane said ok) + geo guard.
-- Lease semantics unchanged: room_ended | not_member drive bg self-terminate.
-- ---------------------------------------------------------------------------
create or replace function public.update_last_seen(
  p_room_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading real default null,
  p_speed real default null
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1 from rooms
    where id = p_room_id and status = 'active'
      and (expires_at is null or expires_at > now())
  ) then
    return jsonb_build_object('ok', false, 'error', 'room_ended');
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('ok', false, 'error', 'bad_destination');
  end if;

  update room_members
  set last_lat = p_lat,
      last_lng = p_lng,
      last_heading = p_heading,
      last_speed = p_speed,
      last_seen_at = now()
  where room_id = p_room_id and user_id = v_uid
    and left_at is null and sharing and role = 'traveler';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Small hardening: snapshot is VOLATILE (clock_timestamp), tables revoke
-- from PUBLIC too, code format check, destinations lookup index.
-- ---------------------------------------------------------------------------
alter function public.get_room_snapshot(uuid) volatile;

revoke insert, update, delete on public.rooms, public.room_members, public.destinations
  from public;

alter table public.rooms add constraint rooms_code_format check (char_length(code) = 6);

create index if not exists destinations_room_idx on public.destinations (room_id);
