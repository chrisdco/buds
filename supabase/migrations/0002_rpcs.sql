-- All mutations go through SECURITY DEFINER RPCs that validate
-- host-ship / capacity / lock / room-active and return typed jsonb results:
--   { ok: true, ... }  |  { ok: false, error: '<code>' }
-- Error codes: not_authenticated, bad_code, bad_mode, bad_role, room_full,
--              room_locked, room_ended, kicked, not_member, not_host, forbidden

create or replace function public.generate_room_code()
returns text
language plpgsql volatile
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
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_mode not in ('solo','converge','multitrack','leader','formation') then
    return jsonb_build_object('ok', false, 'error', 'bad_mode');
  end if;

  insert into rooms (code, name, mode, host_id, leader_id, traveler_limit, expires_at, settings)
  values (
    generate_room_code(),
    trim(p_name),
    p_mode,
    v_uid,
    case when p_mode = 'leader' then v_uid end,
    coalesce(p_traveler_limit, 10),
    p_expires_at,
    coalesce(p_settings, '{}'::jsonb)
  )
  returning * into v_room;

  insert into room_members (room_id, user_id, display_name, role)
  values (v_room.id, v_uid, trim(p_display_name), 'traveler')
  returning * into v_member;

  return jsonb_build_object('ok', true, 'room', to_jsonb(v_room), 'member', to_jsonb(v_member));
end;
$$;

create or replace function public.join_room(
  p_code text,
  p_display_name text,
  p_role text default 'traveler'
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
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

  select * into v_room
  from rooms
  where code = upper(trim(p_code)) and status = 'active';
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

  if v_room.locked then
    return jsonb_build_object('ok', false, 'error', 'room_locked');
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
        display_name = trim(p_display_name),
        arrived_at = null,
        joined_at = now()
    where id = v_member.id
    returning * into v_member;
  else
    insert into room_members (room_id, user_id, display_name, role)
    values (v_room.id, v_uid, trim(p_display_name), p_role)
    returning * into v_member;
  end if;

  return jsonb_build_object('ok', true, 'room', to_jsonb(v_room), 'member', to_jsonb(v_member));
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update room_members
  set left_at = now()
  where room_id = p_room_id and user_id = v_uid and left_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.end_room(p_room_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update rooms
  set status = 'ended', ended_at = now()
  where id = p_room_id and host_id = v_uid and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.kick_member(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from rooms where id = p_room_id and host_id = v_uid and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  if p_user_id = v_uid then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update room_members
  set left_at = now(), kicked = true
  where room_id = p_room_id and user_id = p_user_id and left_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.lock_room(p_room_id uuid, p_locked boolean)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update rooms
  set locked = p_locked
  where id = p_room_id and host_id = v_uid and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_mode(
  p_room_id uuid,
  p_mode text,
  p_settings jsonb default null
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room rooms;
begin
  if p_mode not in ('solo','converge','multitrack','leader','formation') then
    return jsonb_build_object('ok', false, 'error', 'bad_mode');
  end if;
  update rooms
  set mode = p_mode,
      settings = case when p_settings is null then settings else settings || p_settings end,
      leader_id = case when p_mode = 'leader' then coalesce(leader_id, host_id) else leader_id end
  where id = p_room_id and host_id = v_uid and status = 'active'
  returning * into v_room;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  return jsonb_build_object('ok', true, 'room', to_jsonb(v_room));
end;
$$;

create or replace function public.set_leader(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
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

create or replace function public.set_expiry(p_room_id uuid, p_expires_at timestamptz)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update rooms
  set expires_at = p_expires_at
  where id = p_room_id and host_id = v_uid and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

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
  values (p_room_id, p_member_id, coalesce(nullif(trim(p_label), ''), 'Destination'), p_lat, p_lng, v_uid)
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
    where id = p_member_id and room_id = p_room_id;
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

-- Idempotent: first call wins; arrival ranking reads arrived_at ordering.
create or replace function public.mark_arrived(p_room_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member room_members;
begin
  update room_members
  set arrived_at = now()
  where room_id = p_room_id and user_id = v_uid
    and left_at is null and arrived_at is null
  returning * into v_member;
  if not found then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  return jsonb_build_object('ok', true, 'member', to_jsonb(v_member));
end;
$$;

create or replace function public.set_sharing(p_room_id uuid, p_sharing boolean)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update room_members
  set sharing = p_sharing
  where room_id = p_room_id and user_id = v_uid and left_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Low-frequency recovery snapshot (NOT the live tick path; see realtime broadcast).
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

-- One-round-trip state refetch used on join and after reconnect.
create or replace function public.get_room_snapshot(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_room rooms;
begin
  if not is_room_member(p_room_id) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  select * into v_room from rooms where id = p_room_id;
  return jsonb_build_object(
    'ok', true,
    'room', to_jsonb(v_room),
    'members', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.joined_at)
      from room_members m
      where m.room_id = p_room_id and m.left_at is null
    ), '[]'::jsonb),
    'destinations', coalesce((
      select jsonb_agg(to_jsonb(d))
      from destinations d
      where d.room_id = p_room_id
    ), '[]'::jsonb),
    'server_now_ms', (extract(epoch from clock_timestamp()) * 1000)::bigint
  );
end;
$$;

-- Lock function execution down to signed-in (incl. anonymous) users.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
