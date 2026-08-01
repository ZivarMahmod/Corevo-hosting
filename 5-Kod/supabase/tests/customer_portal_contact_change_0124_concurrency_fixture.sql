\set ON_ERROR_STOP on
set request.jwt.claim.role = 'service_role';

insert into public.tenants (id, slug, name, status) values
  ('c1240000-0000-4000-8000-000000000001', 'contact-race-0124', 'Contact Race', 'active');
insert into public.tenant_settings (tenant_id, branding, settings) values (
  'c1240000-0000-4000-8000-000000000001', '{}'::jsonb,
  '{"customer_portal":{"mode":"passwordless_tenant"}}'::jsonb
);
insert into public.customers (id, tenant_id, full_name, phone, status) values
  ('c1240000-0000-4000-8000-000000000011', 'c1240000-0000-4000-8000-000000000001', 'Race A', '+46700000101', 'active'),
  ('c1240000-0000-4000-8000-000000000012', 'c1240000-0000-4000-8000-000000000001', 'Race B', '+46700000102', 'active');
insert into private.customer_portal_sessions (
  public_id, tenant_id, customer_id, secret_digest, key_version,
  idle_expires_at, absolute_expires_at, device_label
) values
  ('c1240000-0000-4000-8000-000000000021', 'c1240000-0000-4000-8000-000000000001',
   'c1240000-0000-4000-8000-000000000011', repeat('a', 64), 1,
   statement_timestamp() + interval '1 day', statement_timestamp() + interval '7 days', 'A'),
  ('c1240000-0000-4000-8000-000000000022', 'c1240000-0000-4000-8000-000000000001',
   'c1240000-0000-4000-8000-000000000012', repeat('b', 64), 1,
   statement_timestamp() + interval '1 day', statement_timestamp() + interval '7 days', 'B');
insert into private.customer_portal_verified_contacts (
  tenant_id, customer_id, channel, contact_digest, contact_masked, source_flow_public_id
) values
  ('c1240000-0000-4000-8000-000000000001', 'c1240000-0000-4000-8000-000000000011',
   'sms', repeat('1', 64), '+46 ••• •• 01', 'c1240000-0000-4000-8000-000000000031'),
  ('c1240000-0000-4000-8000-000000000001', 'c1240000-0000-4000-8000-000000000012',
   'sms', repeat('2', 64), '+46 ••• •• 02', 'c1240000-0000-4000-8000-000000000032');
insert into private.customer_portal_contact_change_flows (
  public_id, tenant_id, customer_id, session_id, subject_digest, key_version, action,
  current_channel, current_contact_digest, current_contact_masked, current_code_digest,
  current_delivery_state, current_delivered_at, current_expires_at, current_resend_after,
  flow_expires_at, current_verified_at, step_up_expires_at,
  new_channel, new_destination, new_contact_digest, new_booking_contact_digest,
  new_contact_masked, new_code_digest, new_delivery_state, new_delivered_at,
  new_expires_at, new_resend_after
) values
  ('c1240000-0000-4000-8000-000000000031', 'c1240000-0000-4000-8000-000000000001',
   'c1240000-0000-4000-8000-000000000011',
   (select id from private.customer_portal_sessions where public_id='c1240000-0000-4000-8000-000000000021'),
   repeat('3',64), 1, 'change_phone', 'sms', repeat('1',64), '+46 ••• •• 01', repeat('4',64),
   'delivered', statement_timestamp(), statement_timestamp()+interval '5 minutes', statement_timestamp()+interval '30 seconds',
   statement_timestamp()+interval '10 minutes', statement_timestamp(), statement_timestamp()+interval '10 minutes',
   'sms', '+46700000099', repeat('5',64), repeat('9',64), '+46 ••• •• 99', repeat('6',64),
   'delivered', statement_timestamp(), statement_timestamp()+interval '5 minutes', statement_timestamp()+interval '30 seconds'),
  ('c1240000-0000-4000-8000-000000000032', 'c1240000-0000-4000-8000-000000000001',
   'c1240000-0000-4000-8000-000000000012',
   (select id from private.customer_portal_sessions where public_id='c1240000-0000-4000-8000-000000000022'),
   repeat('7',64), 1, 'change_phone', 'sms', repeat('2',64), '+46 ••• •• 02', repeat('8',64),
   'delivered', statement_timestamp(), statement_timestamp()+interval '5 minutes', statement_timestamp()+interval '30 seconds',
   statement_timestamp()+interval '10 minutes', statement_timestamp(), statement_timestamp()+interval '10 minutes',
   'sms', '+46700000099', repeat('a',64), repeat('9',64), '+46 ••• •• 99', repeat('b',64),
   'delivered', statement_timestamp(), statement_timestamp()+interval '5 minutes', statement_timestamp()+interval '30 seconds');
