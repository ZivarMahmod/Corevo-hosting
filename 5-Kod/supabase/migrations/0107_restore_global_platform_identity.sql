-- 0107 — Restore the schema effect recorded by 0029 but missing in the legacy
-- production database. Dropping NOT NULL is additive: existing tenant links and
-- the foreign key stay unchanged; only global platform identities may use NULL.

begin;

alter table public.users
  alter column tenant_id drop not null;

comment on column public.users.tenant_id is
  'Nullable: NULL is reserved for a global platform operator without customer-tenant membership.';

commit;
