-- GDPR anonymisation clears quote reply content. Keep Goal 92's delivery FSM
-- consistent in the same write while the scrubbed outbox history remains.
create or replace function private.scrub_offert_reply_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.reply_message is not null
     and new.reply_message is null
     and new.customer_name is null
     and new.customer_email is null
     and new.customer_phone is null
     and new.subject is null
     and new.message is null then
    new.replied_at := null;
    new.reply_delivery_state := 'pending';
    new.reply_outbox_id := null;
    new.reply_error_code := null;
    new.reply_pending_message := null;
    new.reply_content_hash := null;
    new.reply_requested_version := null;
    new.reply_requested_by := null;
  end if;
  return new;
end;
$$;

revoke all on function private.scrub_offert_reply_metadata()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_offert_reply_scrub_consistency
  on public.offert_requests;
create trigger trg_offert_reply_scrub_consistency
  before update on public.offert_requests
  for each row execute function private.scrub_offert_reply_metadata();
