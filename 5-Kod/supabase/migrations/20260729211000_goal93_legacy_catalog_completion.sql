-- Goal 93: complete the DB projection for every legacy theme still renderable in code.
insert into public.templates (
  key,
  name,
  tags,
  tokens,
  sections,
  status,
  contract_version,
  owner,
  selectable,
  replacement_key
) values
  (
    'flora',
    'Flora',
    '{"bransch":"florist","typ":"storefront","scope":"legacy"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'active',
    0,
    'legacy',
    false,
    null
  ),
  (
    'freshcut',
    'FreshCut',
    '{"bransch":"barbershop","typ":"storefront","scope":"customer-locked"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'active',
    0,
    'legacy',
    false,
    null
  ),
  (
    'zentum',
    'Zentum',
    '{"bransch":"ekonomi","typ":"storefront","scope":"legacy"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'active',
    0,
    'legacy',
    false,
    null
  )
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  status = excluded.status,
  contract_version = excluded.contract_version,
  owner = excluded.owner,
  selectable = excluded.selectable,
  replacement_key = excluded.replacement_key,
  updated_at = pg_catalog.now();
