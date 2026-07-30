-- Cover the three foreign keys introduced by Goal 91.
begin;

create index if not exists gift_card_entries_card_tenant_idx
  on public.gift_card_entries (gift_card_id, tenant_id);
create index if not exists gift_card_entries_reversal_tenant_idx
  on public.gift_card_entries (reversal_of, tenant_id);
create index if not exists loyalty_ledger_reversal_tenant_idx
  on public.loyalty_ledger (reversal_of, tenant_id);

commit;
