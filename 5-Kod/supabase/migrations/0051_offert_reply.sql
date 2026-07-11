-- goal-54 körning 3 (A4): offert-svar som faktiskt når kunden.
-- reply_message = det senast skickade svaret (mejlas via mejl-rälsen),
-- replied_at = när det skickades. Interna fältet `note` förblir internt.
alter table offert_requests
  add column if not exists reply_message text,
  add column if not exists replied_at timestamptz;
