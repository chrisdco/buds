-- Server-attested SOS (architecture review, step 3).
--
-- SOS used to be a client 'evt' broadcast whose sender id (`u`) was whatever
-- the sending client wrote, so any member could raise an SOS in someone
-- else's name. It is now a column written only by set_sos() as auth.uid();
-- the existing member_change trigger broadcast carries the row, so receivers
-- learn who raised it from the database, not from a peer. Bonus: the
-- snapshot includes sos_at, so late joiners and reconnects see an active SOS
-- (the broadcast version was ephemeral).

alter table public.room_members add column sos_at timestamptz;

-- Raise (re-stamps now(), which also extends the client-side TTL) or clear
-- the caller's own SOS. Travelers only, active room, active membership.
create or replace function public.set_sos(p_room_id uuid, p_active boolean)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member room_members;
begin
  if not exists (
    select 1 from rooms
    where id = p_room_id and status = 'active'
      and (expires_at is null or expires_at > now())
  ) then
    return jsonb_build_object('ok', false, 'error', 'room_ended');
  end if;

  update room_members
  set sos_at = case when p_active then now() else null end
  where room_id = p_room_id and user_id = v_uid
    and left_at is null and not kicked and role = 'traveler'
  returning * into v_member;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  return jsonb_build_object('ok', true, 'member', to_jsonb(v_member));
end;
$$;

revoke execute on function public.set_sos(uuid, boolean) from public, anon;
grant execute on function public.set_sos(uuid, boolean) to authenticated;

-- Re-create the update trigger so sos_at changes broadcast too (the WHEN list
-- still excludes last_seen-only updates).
drop trigger room_members_broadcast_update on public.room_members;
create trigger room_members_broadcast_update
after update on public.room_members
for each row
when (
  old.display_name is distinct from new.display_name
  or old.role       is distinct from new.role
  or old.sharing    is distinct from new.sharing
  or old.arrived_at is distinct from new.arrived_at
  or old.left_at    is distinct from new.left_at
  or old.kicked     is distinct from new.kicked
  or old.sos_at     is distinct from new.sos_at
)
execute function public.broadcast_room_table_changes();
