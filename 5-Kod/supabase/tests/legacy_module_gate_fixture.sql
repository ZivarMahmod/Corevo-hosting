begin;

-- Old procedural suites test their original database concern, not the module
-- lifecycle added later. The transaction restores the real gate.
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
