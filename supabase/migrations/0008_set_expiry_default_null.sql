-- 0008: set_expiry gains DEFAULT NULL on p_expires_at.
--
-- Clearing the expiry ("Remove limit") passes an explicit null. Without a
-- default the generated client types mark the arg required non-nullable,
-- lying about a call path the app legitimately uses. Same function body as
-- 0007 (past-date + 30d guards preserved); only the signature default changes.
-- Adding a default to the trailing parameter keeps the function identity, so
-- existing positional calls (incl. smoke.sql) are unaffected.

create or replace function public.set_expiry(p_room_id uuid, p_expires_at timestamptz default null)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_expires_at is not null then
    if p_expires_at < now() then
      return jsonb_build_object('ok', false, 'error', 'bad_expiry');
    end if;
    if p_expires_at > now() + interval '30 days' then
      return jsonb_build_object('ok', false, 'error', 'bad_expiry');
    end if;
  end if;
  update rooms
  set expires_at = p_expires_at
  where id = p_room_id and host_id = v_uid and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
