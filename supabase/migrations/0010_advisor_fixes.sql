-- Fixes from the hosted project's first Supabase advisor run.
--
-- 1. broadcast_room_table_changes() is a trigger function. It was created
--    after 0002's blanket revoke, so it kept the default EXECUTE grants and
--    was exposed as /rest/v1/rpc/broadcast_room_table_changes to anon and
--    authenticated. Postgres refuses to run a trigger function outside a
--    trigger, so this was never exploitable, but nothing should be able to
--    call it. Triggers fire as the table owner, so revoking is safe.
-- 2. destinations.member_id had no covering index for its foreign key
--    (on delete cascade from room_members).

revoke execute on function public.broadcast_room_table_changes() from public, anon, authenticated;

create index if not exists destinations_member_idx on public.destinations (member_id);
