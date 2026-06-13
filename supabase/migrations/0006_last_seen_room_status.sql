-- update_last_seen now also reports when the room is no longer active, so the
-- background location task can self-terminate (stop the foreground service) on
-- the HTTPS lane even while the app is suspended and the realtime socket is
-- down — closing the "service keeps running after the room ended" gap.
--   { ok: true } | { ok: false, error: 'room_ended' | 'not_member' }

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
  if not exists (select 1 from rooms where id = p_room_id and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'room_ended');
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
