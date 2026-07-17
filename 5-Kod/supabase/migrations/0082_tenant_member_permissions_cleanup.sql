-- 0082 — Advisor-cleanup efter tenant_member_permissions.
--
-- Direkt insert/update/delete är revokat för authenticated och alla legitima
-- writes går genom de två validerande RPC:erna. ALL-policyn kan därför inte ge
-- någon skrivförmåga, men skapar en onödig andra permissiv SELECT-policy.
drop policy if exists tenant_member_permissions_owner_write
  on public.tenant_member_permissions;

-- UNIQUE (tenant_id, staff_id) skapade redan ett btree-index med tenant_id som
-- första kolumn. Det separata tenant-indexet är redundant.
drop index if exists public.tenant_member_permissions_tenant_idx;
