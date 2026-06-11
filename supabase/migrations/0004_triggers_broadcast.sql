-- Control-plane changes (room settings, membership, destinations) are pushed
-- to all clients in the room channel via realtime.broadcast_changes().
-- Event names received by clients: 'room_change' | 'member_change' | 'dest_change'.

create or replace function public.broadcast_room_table_changes()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_room_id uuid;
  v_event text;
begin
  if tg_table_name = 'rooms' then
    v_room_id := coalesce(new.id, old.id);
    v_event := 'room_change';
  elsif tg_table_name = 'room_members' then
    v_room_id := coalesce(new.room_id, old.room_id);
    v_event := 'member_change';
  else
    v_room_id := coalesce(new.room_id, old.room_id);
    v_event := 'dest_change';
  end if;

  perform realtime.broadcast_changes(
    'room:' || v_room_id::text,
    v_event,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

create trigger rooms_broadcast
after insert or update on public.rooms
for each row execute function public.broadcast_room_table_changes();

create trigger room_members_broadcast_insert
after insert on public.room_members
for each row execute function public.broadcast_room_table_changes();

-- Suppress broadcasts for last_seen-only updates (update_last_seen runs every
-- ~60s per traveler; peers already get live positions via the 'loc' broadcast
-- lane, so re-broadcasting the recovery snapshot would waste message quota).
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
)
execute function public.broadcast_room_table_changes();

create trigger destinations_broadcast
after insert or update or delete on public.destinations
for each row execute function public.broadcast_room_table_changes();
