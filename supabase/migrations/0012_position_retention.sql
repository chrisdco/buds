-- Location retention: a member's last known position (the ~60 s recovery
-- snapshot from update_last_seen) is only needed while the trip is live.
-- Clear it shortly after the room ends or the member leaves, so no one's
-- whereabouts sit in the database after the trip.

create or replace function public.clear_stale_positions()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.room_members m
  set last_lat = null,
      last_lng = null,
      last_heading = null,
      last_speed = null
  where m.last_lat is not null
    and (
      (m.left_at is not null and m.left_at < now() - interval '10 minutes')
      or exists (
        select 1 from public.rooms r
        where r.id = m.room_id
          and r.status = 'ended'
          and coalesce(r.ended_at, now()) < now() - interval '10 minutes'
      )
    );
$$;

revoke all on function public.clear_stale_positions() from public, anon, authenticated;

select cron.schedule(
  'buds-clear-stale-positions',
  '*/15 * * * *',
  $$ select public.clear_stale_positions() $$
);
