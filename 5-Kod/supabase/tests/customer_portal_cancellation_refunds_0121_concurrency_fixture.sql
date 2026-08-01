\set ON_ERROR_STOP on
set request.jwt.claim.role = 'service_role';

insert into public.tenants (
  id, slug, name, status, stripe_account_id, stripe_charges_enabled
) values (
  'c1210000-0000-4000-8000-000000000001','refund-concurrency-0121',
  'Refund Concurrency 0121','active','acct_concurrency_0121',true
);
insert into public.roles (id,tenant_id,name,level) values (
  'c1210000-0000-4000-8000-000000000011','c1210000-0000-4000-8000-000000000001','kund-0121',2
);
insert into public.tenant_settings (tenant_id,branding,settings) values (
  'c1210000-0000-4000-8000-000000000001','{}'::jsonb,
  '{"customer_portal":{"mode":"passwordless_tenant"},"cancellation_cutoff_hours":24}'::jsonb
);
insert into auth.users (id,email) values (
  'c1210000-0000-4000-8000-000000000021','refund-concurrency-0121@example.test'
);
insert into public.users (id,tenant_id,email,role_id,status) values (
  'c1210000-0000-4000-8000-000000000021','c1210000-0000-4000-8000-000000000001',
  'refund-concurrency-0121@example.test','c1210000-0000-4000-8000-000000000011','active'
);
insert into public.customers (id,tenant_id,auth_user_id,full_name,phone,status) values (
  'c1210000-0000-4000-8000-000000000031','c1210000-0000-4000-8000-000000000001',
  'c1210000-0000-4000-8000-000000000021','Concurrency Customer','+46700000123','active'
);
insert into public.locations (id,tenant_id,name,timezone,is_primary) values (
  'c1210000-0000-4000-8000-000000000041','c1210000-0000-4000-8000-000000000001',
  'Concurrency','Europe/Stockholm',true
);
insert into public.staff (id,tenant_id,location_id,title,active) values (
  'c1210000-0000-4000-8000-000000000051','c1210000-0000-4000-8000-000000000001',
  'c1210000-0000-4000-8000-000000000041','Concurrency',true
);
insert into public.services (id,tenant_id,location_id,name,duration_min,price_cents,active) values (
  'c1210000-0000-4000-8000-000000000061','c1210000-0000-4000-8000-000000000001',
  'c1210000-0000-4000-8000-000000000041','Concurrency',30,10000,true
);
insert into public.bookings (
  id,tenant_id,location_id,staff_id,service_id,customer_profile_id,customer_id,
  start_ts,end_ts,status,price_cents
) values
  ('c1210000-0000-4000-8000-000000000071','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000041','c1210000-0000-4000-8000-000000000051','c1210000-0000-4000-8000-000000000061','c1210000-0000-4000-8000-000000000021','c1210000-0000-4000-8000-000000000031',statement_timestamp()+interval '30 days',statement_timestamp()+interval '30 days 30 minutes','cancelled',10000),
  ('c1210000-0000-4000-8000-000000000072','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000041','c1210000-0000-4000-8000-000000000051','c1210000-0000-4000-8000-000000000061','c1210000-0000-4000-8000-000000000021','c1210000-0000-4000-8000-000000000031',statement_timestamp()+interval '31 days',statement_timestamp()+interval '31 days 30 minutes','cancelled',10000),
  ('c1210000-0000-4000-8000-000000000073','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000041','c1210000-0000-4000-8000-000000000051','c1210000-0000-4000-8000-000000000061','c1210000-0000-4000-8000-000000000021','c1210000-0000-4000-8000-000000000031',statement_timestamp()+interval '35 days',statement_timestamp()+interval '35 days 30 minutes','confirmed',10000),
  ('c1210000-0000-4000-8000-000000000091','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000041','c1210000-0000-4000-8000-000000000051','c1210000-0000-4000-8000-000000000061','c1210000-0000-4000-8000-000000000021','c1210000-0000-4000-8000-000000000031',statement_timestamp()+interval '32 days',statement_timestamp()+interval '32 days 30 minutes','confirmed',10000),
  ('c1210000-0000-4000-8000-000000000092','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000041','c1210000-0000-4000-8000-000000000051','c1210000-0000-4000-8000-000000000061','c1210000-0000-4000-8000-000000000021','c1210000-0000-4000-8000-000000000031',statement_timestamp()+interval '33 days',statement_timestamp()+interval '33 days 30 minutes','pending',10000),
  ('c1210000-0000-4000-8000-000000000093','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000041','c1210000-0000-4000-8000-000000000051','c1210000-0000-4000-8000-000000000061','c1210000-0000-4000-8000-000000000021','c1210000-0000-4000-8000-000000000031',statement_timestamp()+interval '34 days',statement_timestamp()+interval '34 days 30 minutes','pending',10000);
insert into public.payments (
  id,tenant_id,booking_id,amount_cents,currency,status,
  stripe_payment_intent_id,stripe_connected_account_id
) values
  ('c1210000-0000-4000-8000-000000000081','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000071',10000,'sek','succeeded','pi_concurrency_job_1','acct_concurrency_0121'),
  ('c1210000-0000-4000-8000-000000000082','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000072',10000,'sek','succeeded','pi_concurrency_job_2','acct_concurrency_0121'),
  ('c1210000-0000-4000-8000-000000000094','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000091',10000,'sek','succeeded','pi_concurrency_rebook','acct_concurrency_0121');
insert into private.payment_refund_jobs (
  id,tenant_id,payment_id,booking_id,provider_payment_intent_id,
  provider_connected_account_id,provider_idempotency_key
) values
  ('c1210000-0000-4000-8000-000000000101','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000081','c1210000-0000-4000-8000-000000000071','pi_concurrency_job_1','acct_concurrency_0121','refund_c1210000-0000-4000-8000-000000000071'),
  ('c1210000-0000-4000-8000-000000000102','c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000082','c1210000-0000-4000-8000-000000000072','pi_concurrency_job_2','acct_concurrency_0121','refund_c1210000-0000-4000-8000-000000000072');
insert into private.customer_portal_sessions (
  public_id,tenant_id,customer_id,secret_digest,key_version,
  idle_expires_at,absolute_expires_at
) values (
  'c1210000-0000-4000-8000-000000000111','c1210000-0000-4000-8000-000000000001',
  'c1210000-0000-4000-8000-000000000031',repeat('z',64),1,
  statement_timestamp()+interval '1 day',statement_timestamp()+interval '7 days'
);
