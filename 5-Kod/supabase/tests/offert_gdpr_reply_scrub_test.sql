begin;

do $$
declare
  v_sql text := pg_catalog.lower(pg_catalog.pg_get_functiondef(
    'private.scrub_offert_reply_metadata()'::regprocedure
  ));
begin
  if v_sql not like '%new.reply_delivery_state := ''pending''%'
     or v_sql not like '%new.reply_outbox_id := null%'
     or v_sql not like '%new.reply_pending_message := null%'
     or v_sql not like '%new.reply_content_hash := null%' then
    raise exception 'offert_gdpr_reply_scrub_incomplete';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.offert_requests'::regclass
      and tgname = 'trg_offert_reply_scrub_consistency'
      and not tgisinternal
  ) then
    raise exception 'offert_gdpr_reply_scrub_trigger_missing';
  end if;
end;
$$;

rollback;
