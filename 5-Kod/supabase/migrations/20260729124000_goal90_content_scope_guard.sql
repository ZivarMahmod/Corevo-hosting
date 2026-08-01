-- Goal 90 correction: tenant-wide content mutations require organization scope.
begin;

-- Keep the already-tested lifecycle implementations intact and put one narrow
-- authorization wrapper in front of each public SECURITY DEFINER entry point.
alter function public.set_blog_post_status(uuid, uuid, text)
  set schema private;
alter function private.set_blog_post_status(uuid, uuid, text)
  rename to goal90_set_blog_post_status_impl;

alter function public.set_tenant_event_status(uuid, uuid, text, text)
  set schema private;
alter function private.set_tenant_event_status(uuid, uuid, text, text)
  rename to goal90_set_tenant_event_status_impl;

alter function public.set_event_registration_status(uuid, uuid, text, text)
  set schema private;
alter function private.set_event_registration_status(uuid, uuid, text, text)
  rename to goal90_set_event_registration_status_impl;

revoke all on function private.goal90_set_blog_post_status_impl(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.goal90_set_tenant_event_status_impl(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.goal90_set_event_registration_status_impl(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

create function private.require_goal90_content_admin(
  p_tenant uuid,
  p_error text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant uuid := (select private.tenant_id());
  v_level integer := (select private.role_level());
  v_external_scope boolean := (select private.can_access_tenant(p_tenant));
begin
  if v_uid is null
     or not (
       (
         v_tenant = p_tenant
         and coalesce(v_level, 0) >= 6
         and (select private.has_organization_scope())
       )
       or coalesce(v_external_scope, false)
     ) then
    raise exception using message = p_error, errcode = '42501';
  end if;
end;
$$;

revoke all on function private.require_goal90_content_admin(uuid, text)
  from public, anon, authenticated, service_role;

create function public.set_blog_post_status(
  p_tenant uuid,
  p_post uuid,
  p_status text
) returns table (
  outcome text,
  blog_status text,
  first_published_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_goal90_content_admin(
    p_tenant,
    'blog_post_status_access_denied'
  );
  return query
    select impl.outcome, impl.blog_status, impl.first_published_at
      from private.goal90_set_blog_post_status_impl(
        p_tenant,
        p_post,
        p_status
      ) impl;
end;
$$;

create function public.set_tenant_event_status(
  p_tenant uuid,
  p_event uuid,
  p_status text,
  p_reason text default null
) returns table (
  outcome text,
  event_status text,
  version integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_goal90_content_admin(
    p_tenant,
    'event_status_access_denied'
  );
  return query
    select impl.outcome, impl.event_status, impl.version
      from private.goal90_set_tenant_event_status_impl(
        p_tenant,
        p_event,
        p_status,
        p_reason
      ) impl;
end;
$$;

create function public.set_event_registration_status(
  p_tenant uuid,
  p_registration uuid,
  p_status text,
  p_reason text default null
) returns table (
  outcome text,
  registration_status text,
  version integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_goal90_content_admin(
    p_tenant,
    'event_registration_status_access_denied'
  );
  return query
    select impl.outcome, impl.registration_status, impl.version
      from private.goal90_set_event_registration_status_impl(
        p_tenant,
        p_registration,
        p_status,
        p_reason
      ) impl;
end;
$$;

revoke all on function public.set_blog_post_status(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_blog_post_status(uuid, uuid, text)
  to authenticated;

revoke all on function public.set_tenant_event_status(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_tenant_event_status(uuid, uuid, text, text)
  to authenticated;

revoke all on function public.set_event_registration_status(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_event_registration_status(uuid, uuid, text, text)
  to authenticated;

comment on function public.set_blog_post_status(uuid, uuid, text) is
  'Goal 90: organization-scoped wrapper for the locked blog lifecycle.';
comment on function public.set_tenant_event_status(uuid, uuid, text, text) is
  'Goal 90: organization-scoped wrapper for the locked event lifecycle.';
comment on function public.set_event_registration_status(uuid, uuid, text, text) is
  'Goal 90: organization-scoped wrapper for the locked registration lifecycle.';

commit;
