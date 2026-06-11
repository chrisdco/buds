-- End-to-end smoke test for the RPC layer. Runs against a local stack:
--   npx supabase db reset
--   Get-Content supabase/tests/smoke.sql -Raw | docker exec -i supabase_db_buds psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -
-- Simulates three anonymous users by switching request.jwt.claims, walks the
-- whole room lifecycle, and raises (non-zero exit) on any unexpected result.
-- Everything is rolled back at the end.

begin;

do $smoke$
declare
  alice constant text := '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  bob   constant text := '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  carol constant text := '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  v jsonb;
  v_code text;
  v_room uuid;
begin
  -- Alice creates a room with a traveler limit of 2
  perform set_config('request.jwt.claims', alice, true);
  v := public.create_room('Smoke trip', 'Alice', 'converge', 2);
  if not (v->>'ok')::boolean then raise exception 'create_room failed: %', v; end if;
  v_code := v->'room'->>'code';
  v_room := (v->'room'->>'id')::uuid;
  if length(v_code) <> 6 then raise exception 'bad room code: %', v_code; end if;
  if (v->'member'->>'role') <> 'traveler' then raise exception 'host not traveler: %', v; end if;

  -- create_room rejects an invalid mode with a typed error
  v := public.create_room('Bad', 'Alice', 'warp');
  if (v->>'ok')::boolean or v->>'error' <> 'bad_mode' then
    raise exception 'expected bad_mode, got %', v;
  end if;

  -- Bob joins as traveler (fills the room) — regression check for the FOUND
  -- clobbering bug: member must be non-null for a brand-new join
  perform set_config('request.jwt.claims', bob, true);
  v := public.join_room(v_code, 'Bob', 'traveler');
  if not (v->>'ok')::boolean then raise exception 'join_room failed: %', v; end if;
  if v->'member'->>'id' is null or v->'member' = 'null'::jsonb then
    raise exception 'join_room returned null member: %', v;
  end if;

  -- joining again is idempotent
  v := public.join_room(v_code, 'Bob', 'traveler');
  if not (v->>'ok')::boolean then raise exception 'rejoin not idempotent: %', v; end if;

  -- a wrong code yields bad_code
  v := public.join_room('ZZZZZZ', 'Bob', 'traveler');
  if v->>'error' is distinct from 'bad_code' then raise exception 'expected bad_code, got %', v; end if;

  -- Carol can't join as traveler (room full), but can spectate
  perform set_config('request.jwt.claims', carol, true);
  v := public.join_room(v_code, 'Carol', 'traveler');
  if v->>'error' is distinct from 'room_full' then raise exception 'expected room_full, got %', v; end if;
  v := public.join_room(v_code, 'Carol', 'spectator');
  if not (v->>'ok')::boolean then raise exception 'spectator join failed: %', v; end if;

  -- Bob (not host) cannot set the room-level destination
  perform set_config('request.jwt.claims', bob, true);
  v := public.set_destination(v_room, 48.2082, 16.3738, 'Meet', null);
  if (v->>'ok')::boolean then raise exception 'non-host set room destination'; end if;

  -- the host can; doing it twice upserts rather than erroring
  perform set_config('request.jwt.claims', alice, true);
  v := public.set_destination(v_room, 48.2082, 16.3738, 'Meet', null);
  if not (v->>'ok')::boolean then raise exception 'host set_destination failed: %', v; end if;
  v := public.set_destination(v_room, 48.2100, 16.3700, 'Meet v2', null);
  if not (v->>'ok')::boolean then raise exception 'destination upsert failed: %', v; end if;

  -- Bob records his recovery snapshot and reads the room state
  perform set_config('request.jwt.claims', bob, true);
  v := public.update_last_seen(v_room, 48.19, 16.36, 90, 3.2);
  if not (v->>'ok')::boolean then raise exception 'update_last_seen failed: %', v; end if;

  v := public.get_room_snapshot(v_room);
  if not (v->>'ok')::boolean then raise exception 'snapshot failed: %', v; end if;
  if jsonb_array_length(v->'members') <> 3 then
    raise exception 'expected 3 members in snapshot, got %', v->'members';
  end if;
  if (v->'destinations'->0->>'label') <> 'Meet v2' then
    raise exception 'destination not upserted: %', v->'destinations';
  end if;

  -- arrival is idempotent: first call sets, second reports already
  v := public.mark_arrived(v_room);
  if v->'member'->>'arrived_at' is null then raise exception 'mark_arrived failed: %', v; end if;
  v := public.mark_arrived(v_room);
  if (v->>'already') is distinct from 'true' then raise exception 'mark_arrived not idempotent: %', v; end if;

  -- pause sharing
  v := public.set_sharing(v_room, false);
  if not (v->>'ok')::boolean then raise exception 'set_sharing failed: %', v; end if;

  -- host kicks Carol; Carol can't come back
  perform set_config('request.jwt.claims', alice, true);
  v := public.kick_member(v_room, '33333333-3333-3333-3333-333333333333');
  if not (v->>'ok')::boolean then raise exception 'kick failed: %', v; end if;
  perform set_config('request.jwt.claims', carol, true);
  v := public.join_room(v_code, 'Carol', 'spectator');
  if v->>'error' is distinct from 'kicked' then raise exception 'expected kicked, got %', v; end if;

  -- locking blocks new joiners with a typed error
  perform set_config('request.jwt.claims', alice, true);
  v := public.lock_room(v_room, true);
  if not (v->>'ok')::boolean then raise exception 'lock failed: %', v; end if;
  perform set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
  v := public.join_room(v_code, 'Dave', 'spectator');
  if v->>'error' is distinct from 'room_locked' then raise exception 'expected room_locked, got %', v; end if;

  -- mode switch by host
  perform set_config('request.jwt.claims', alice, true);
  v := public.set_mode(v_room, 'leader', '{"separation_alert_m": 400}'::jsonb);
  if not (v->>'ok')::boolean then raise exception 'set_mode failed: %', v; end if;
  if (v->'room'->>'leader_id') is null then raise exception 'leader not defaulted: %', v; end if;

  -- end the room; the code is then unknown to joiners
  v := public.end_room(v_room);
  if not (v->>'ok')::boolean then raise exception 'end_room failed: %', v; end if;
  v := public.join_room(v_code, 'Dave', 'traveler');
  if v->>'error' is distinct from 'bad_code' then raise exception 'expected bad_code after end, got %', v; end if;

  raise notice 'SMOKE OK — all RPC paths behaved';
end
$smoke$;

rollback;
