-- 0104 upgrade-path contract. The broader routing runtime test exercises the
-- pending -> confirmed sequence; this file ensures the latest migration itself
-- installed the new event on databases that had already applied 0100.
begin;

do $$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.route_booking_notification(uuid,uuid,uuid,text,text,text,text,text[],jsonb,boolean,text,uuid)'::regprocedure
  ) into v_definition;

  if pg_catalog.strpos(v_definition, 'booking_request_received') = 0 then
    raise exception 'booking_request_received_not_installed_by_0104';
  end if;
  if pg_catalog.strpos(
    v_definition,
    $needle$p_event_type in ('booking_request_received', 'booking_confirmation')$needle$
  ) = 0 then
    raise exception 'request_received_does_not_share_confirmation_setting';
  end if;
end $$;

rollback;
