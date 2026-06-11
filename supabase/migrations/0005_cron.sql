-- Expiry sweep: ends rooms whose expires_at has passed. The rooms_broadcast
-- trigger then pushes 'room_change' (status=ended) to every connected client.

create extension if not exists pg_cron;

select cron.schedule(
  'buds-expire-rooms',
  '*/5 * * * *',
  $$
    update public.rooms
    set status = 'ended', ended_at = now()
    where status = 'active'
      and expires_at is not null
      and expires_at < now()
  $$
);
