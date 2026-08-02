begin;

-- Old procedural suites test their original database concern, not module or
-- staff-readiness gates added later. The transaction restores the real gates.
alter table public.staff disable trigger trg_staff_activation_readiness;

create or replace function private.module_public_action_allowed(
  p_tenant uuid,
  p_module text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select true
$$;
