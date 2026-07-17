-- 0084 — stäng direkt anon-INSERT till tabeller med kontakt-PII.
--
-- Publika formulär går genom validerade server actions som resolverar tenant ur
-- hosten, rate-limitar och använder service_role först efter godkänd validering.
-- En direkt PostgREST-klient ska aldrig kunna kringgå dessa kontroller.

drop policy if exists contact_messages_public_insert
  on public.contact_messages;
revoke insert on public.contact_messages from public, anon, authenticated;
grant insert on public.contact_messages to service_role;

drop policy if exists offert_requests_public_insert
  on public.offert_requests;
revoke insert on public.offert_requests from public, anon, authenticated;
grant insert on public.offert_requests to service_role;

drop policy if exists event_registrations_public_insert
  on public.event_registrations;
revoke insert on public.event_registrations from public, anon, authenticated;
grant insert on public.event_registrations to service_role;
