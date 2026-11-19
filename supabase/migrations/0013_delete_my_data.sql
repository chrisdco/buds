-- "Delete my data": removes everything the server holds about the caller.
-- Called by the app's Settings → Delete my data (before it signs out), so
-- account deletion works in-app as Google Play requires.
--
-- 1. Leaves every room the caller is still in (leave_room hands host/leader
--    to someone else, exactly as a normal leave).
-- 2. Deletes the caller's memberships everywhere (display name, last
--    position); their personal destinations go with them (FK cascade).
-- 3. Deletes rooms the caller hosted that nobody else is in any more.
-- The anonymous auth user itself holds no personal data and is left to
-- Supabase's own cleanup.

create or replace function public.delete_my_data()
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  for v_room in
    select room_id from room_members where user_id = v_uid and left_at is null
  loop
    perform public.leave_room(v_room);
  end loop;

  delete from room_members where user_id = v_uid;

  delete from rooms r
  where r.host_id = v_uid
    and not exists (select 1 from room_members m where m.room_id = r.id);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
