-- U3: 46elks delivery reports land only in the durable notifications_outbox.
-- No SMS transport is enabled by this migration; Worker config remains off.

create unique index if not exists notifications_outbox_sms_provider_ref_unique
  on public.notifications_outbox (provider_ref)
  where chosen_channel = 'sms' and provider_ref is not null;

create or replace function public.record_sms_delivery(
  p_provider_ref text,
  p_status text,
  p_delivered_at timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_current text;
begin
  if p_provider_ref is null
     or p_provider_ref !~ '^s[a-f0-9]{32}$' then
    raise exception 'sms_provider_ref_invalid' using errcode = '22023';
  end if;
  if p_status not in ('sent', 'delivered', 'failed') then
    raise exception 'sms_delivery_status_invalid' using errcode = '22023';
  end if;
  if (p_status = 'delivered' and p_delivered_at is null)
     or (p_status <> 'delivered' and p_delivered_at is not null) then
    raise exception 'sms_delivery_timestamp_invalid' using errcode = '22023';
  end if;

  select o.id, o.status
    into v_id, v_current
    from public.notifications_outbox o
   where o.chosen_channel = 'sms'
     and o.provider_ref = p_provider_ref
   for update;

  if v_id is null then return 'unknown_provider'; end if;
  if v_current = p_status then return 'idempotent'; end if;
  -- delivered/failed är terminala. En sen eller omordnad callback får aldrig
  -- backa leveransen eller byta en redan observerad terminal sanning.
  if v_current in ('delivered', 'failed') then return 'terminal'; end if;

  update public.notifications_outbox
     set status = p_status,
         sent_at = coalesce(sent_at, now()),
         delivered_at = case
           when p_status = 'delivered' then p_delivered_at
           else delivered_at
         end,
         skip_reason = case
           when p_status = 'failed' then 'provider_rejected'
           else null
         end,
         last_error = case
           when p_status = 'failed' then 'provider_rejected'
           else null
         end,
         updated_at = now()
   where id = v_id
     and status not in ('delivered', 'failed');

  return 'updated';
end;
$$;

revoke all on function public.record_sms_delivery(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_sms_delivery(text, text, timestamptz)
  to service_role;
