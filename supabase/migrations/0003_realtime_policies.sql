-- Authorization for private Realtime channels ("room:<uuid>").
-- Clients join with { config: { private: true } }; Realtime checks RLS on
-- realtime.messages at channel join and on every broadcast/presence write.
-- Both planes (broadcast + presence) are gated on active room membership;
-- spectators can read AND write (they need presence), but clients ignore
-- 'loc' broadcasts from spectator user_ids.

create policy "room members can receive"
on realtime.messages
for select
to authenticated
using (public.is_room_topic_member(realtime.topic()));

create policy "room members can send"
on realtime.messages
for insert
to authenticated
with check (public.is_room_topic_member(realtime.topic()));
