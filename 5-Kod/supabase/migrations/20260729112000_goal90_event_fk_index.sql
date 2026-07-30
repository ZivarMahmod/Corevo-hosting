create index if not exists event_registrations_event_tenant_idx
  on public.event_registrations (event_id, tenant_id);
