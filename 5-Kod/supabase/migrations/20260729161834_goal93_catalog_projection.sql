-- Goal 93: versioned Corevo theme catalog projection.
-- Code remains the runtime source; these rows are constrained, read-only catalog data.

alter table public.templates
  add column if not exists contract_version integer not null default 0,
  add column if not exists owner text not null default 'legacy',
  add column if not exists selectable boolean not null default false,
  add column if not exists replacement_key text;

alter table public.templates drop constraint if exists templates_status_check;
alter table public.templates drop constraint if exists templates_contract_version_check;
alter table public.templates drop constraint if exists templates_owner_check;
alter table public.templates drop constraint if exists templates_selectable_active_check;
alter table public.templates drop constraint if exists templates_replacement_state_check;
alter table public.templates drop constraint if exists templates_replacement_not_self_check;

alter table public.templates
  add constraint templates_status_check
    check (status in ('draft', 'active', 'deprecated', 'archived')),
  add constraint templates_contract_version_check
    check (contract_version >= 0),
  add constraint templates_owner_check
    check (pg_catalog.length(pg_catalog.btrim(owner)) > 0),
  add constraint templates_selectable_active_check
    check (not selectable or status = 'active'),
  add constraint templates_replacement_state_check
    check (
      (status = 'deprecated' and replacement_key is not null)
      or (status <> 'deprecated' and replacement_key is null)
    ),
  add constraint templates_replacement_not_self_check
    check (replacement_key is null or replacement_key <> key);

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.templates'::pg_catalog.regclass
       and conname = 'templates_replacement_key_fkey'
  ) then
    alter table public.templates
      add constraint templates_replacement_key_fkey
      foreign key (replacement_key)
      references public.templates(key)
      on update cascade
      on delete restrict;
  end if;
end
$$;

create index if not exists templates_replacement_key_idx
  on public.templates (replacement_key)
  where replacement_key is not null;

create or replace function private.enforce_template_catalog_replacement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target_status text;
begin
  -- ponytail: catalog writes are rare; one transaction lock is the smallest
  -- race-free rule. Split per key only if catalog write throughput is measurable.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('corevo-template-catalog', 0)
  );

  if new.status = 'deprecated' then
    select t.status
      into v_target_status
      from public.templates t
     where t.key = new.replacement_key;
    if v_target_status is distinct from 'active' then
      raise exception 'template_replacement_not_active'
        using errcode = '23514';
    end if;
  end if;

  if new.status <> 'active'
     and exists (
       select 1
         from public.templates t
        where t.replacement_key = new.key
          and t.status = 'deprecated'
     ) then
    raise exception 'template_active_replacement_is_referenced'
      using errcode = '23514';
  end if;

  return new;
end
$$;

revoke all on function private.enforce_template_catalog_replacement()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_templates_replacement_integrity on public.templates;
create trigger trg_templates_replacement_integrity
  before insert or update of key, status, replacement_key
  on public.templates
  for each row execute function private.enforce_template_catalog_replacement();

create table if not exists public.template_verticals (
  template_key text not null
    references public.templates(key) on update cascade on delete cascade,
  vertical_key text not null
    references public.verticals(key) on update cascade on delete restrict,
  primary key (template_key, vertical_key)
);

create table if not exists public.template_required_modules (
  template_key text not null
    references public.templates(key) on update cascade on delete cascade,
  module_key text not null
    references public.modules(key) on update cascade on delete restrict,
  primary key (template_key, module_key)
);

create index if not exists template_verticals_vertical_key_idx
  on public.template_verticals (vertical_key);
create index if not exists template_required_modules_module_key_idx
  on public.template_required_modules (module_key);

insert into public.verticals (
  key,
  name,
  default_modules,
  default_template,
  terminology,
  rules
) values (
  'florist',
  'Florist',
  '{
    "booking":"live",
    "shop":"draft",
    "blogg":"draft",
    "galleri":"draft",
    "lojalitet":"draft",
    "offert":"draft",
    "presentkort":"draft",
    "kurser":"draft"
  }'::jsonb,
  null,
  '{
    "staff":"Florist",
    "staff_plural":"Florister",
    "service":"Beställning",
    "business":"Blomsterbutik"
  }'::jsonb,
  '{}'::jsonb
)
on conflict (key) do nothing;

insert into public.templates (
  key,
  name,
  tags,
  tokens,
  sections,
  status,
  contract_version,
  owner,
  selectable
) values
  ('ateljevinter', 'Ateljé Vinter', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#6F7D6E","primaryD":"#5A6659","bg":"#FBFBF9","surface":"#F3F3EE","fg":"#161616","fg2":"#8B8B85","line":"#E4E4DE","accentSoft":"#B9B9B2"},"font":{"heading":"Manrope","body":"Manrope"},"layout":{"radius":"0px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":true,"homeAbout":true}}'::jsonb, '["hem","butik","korg","kassa","bekraftelse","boka","kurser","galleri","blogg","vanner","offert","presentkort","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true),
  ('aurora', 'Aurora', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#B85C48","primaryD":"#8A3E2E","bg":"#FAF1EC","surface":"#F3DED4","fg":"#3A2A24","fg2":"#7A6257","line":"#EAD8CD","accentSoft":"#F3DED4"},"font":{"heading":"Lora","body":"Nunito Sans"},"layout":{"radius":"24px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","butik","brollop","blogg","om","kontakt","korg","kassa","bekraftelse","boka","kurser","galleri","presentkort","klubben","offert"]'::jsonb, 'active', 1, 'corevo', true),
  ('blomstertorget', 'Blomstertorget', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#C1272D","primaryD":"#9E1F24","bg":"#F5F1E8","surface":"#EDE7D8","fg":"#191714","fg2":"#6E6A61","line":"#A8A296","accentSoft":"#EDE7D8"},"font":{"heading":"Archivo","body":"Newsreader"},"layout":{"radius":"0px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","butik","korg","kassa","bekraftelse","kurser","galleri","blogg","stamkund","offert","presentkort","boka","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true),
  ('calytrix', 'Calytrix', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#7d1f46","primaryD":"#4a0e2e","bg":"#fbf6f4","surface":"#ffffff","fg":"#241019","fg2":"#6e4f5c","line":"#a98d97","accentSoft":"#e8d9de"},"font":{"heading":"Instrument Serif","body":"Instrument Sans"},"layout":{"radius":"0px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["kurser","galleri","blogg","bokning","presentkort","club","offert","kassa","bekraftelse","hem","butik","leverans","om","kontakt","varukorg"]'::jsonb, 'active', 1, 'corevo', true),
  ('eloria', 'Eloria', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#7A5D1E","primaryD":"#5E4715","bg":"#FBF3EE","surface":"#FFFFFF","fg":"#182A20","fg2":"#6B5548","line":"#E8D9C9","accentSoft":"#D9BE7B"},"font":{"heading":"Cormorant Garamond","body":"Mulish"},"layout":{"radius":"0px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","katalog","brollop","journal","om","kontakt","bestallning","kassa","bekraftelse","konsultation","kurser","galleri","presentkort","vanner","offert"]'::jsonb, 'active', 1, 'corevo', true),
  ('kalla', 'Källa', '{"bransch":"frisör","design_bransch":"salong","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#1D5E54","primaryD":"#143F39","bg":"#F3EFE7","surface":"#FBFAF5","fg":"#22302B","fg2":"#5F6B60","line":"#DAD3C2","accentSoft":"#E4EAE3"},"font":{"heading":"Marcellus","body":"Karla"},"layout":{"radius":"8px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","behandlingar","boka","team","butik","korg","kassa","bekraftelse","galleri","journal","klubb","presentkort","event","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true),
  ('lunaria', 'Lunaria', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#C6A664","primaryD":"#B08F4C","bg":"#10233A","surface":"#17304C","fg":"#ECE6D6","fg2":"#B8BFCB","line":"#334455","accentSoft":"#7C8AA0"},"font":{"heading":"Poiret One","body":"Jost"},"layout":{"radius":"0px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","butik","korg","kassa","bekraftelse","boka","kurser","galleri","blogg","klubb","offert","presentkort","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true),
  ('onyx', 'Onyx', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#C9973F","primaryD":"#B08434","bg":"#121212","surface":"#1C1C1C","fg":"#F2EFEA","fg2":"#9C968C","line":"#2E2E2E","accentSoft":"#6B655B"},"font":{"heading":"Space Grotesk","body":"IBM Plex Mono"},"layout":{"radius":"0px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","butik","korg","kassa","bekraftelse","boka","kurser","galleri","blogg","krets","offert","presentkort","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true),
  ('siluett', 'Siluett', '{"bransch":"frisör","design_bransch":"salong","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#6741D9","primaryD":"#4E2BBE","bg":"#F6F4EF","surface":"#FFFFFF","fg":"#131313","fg2":"#6E685D","line":"#E5E0D4","accentSoft":"#ECE5FB"},"font":{"heading":"Bodoni Moda","body":"Schibsted Grotesk"},"layout":{"radius":"0px","navHeight":{"desktop":"64px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","priser","boka","team","butik","korg","kassa","bekraftelse","galleri","journal","klubb","presentkort","event","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true),
  ('sivsav', 'Siv & Säv', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#7C8B6B","primaryD":"#647253","bg":"#F4F1EA","surface":"#FFFFFF","fg":"#33352E","fg2":"#6B6D60","line":"#DAD7C8","accentSoft":"#E4E7DA"},"font":{"heading":"Fraunces","body":"Hanken Grotesk"},"layout":{"radius":"24px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","butik","korg","kassa","bekraftelse","boka","kurser","galleri","blogg","klubb","offert","presentkort","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true),
  ('snitt', 'Snitt', '{"bransch":"frisör","design_bransch":"salong","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#D6F344","primaryD":"#C4E52F","bg":"#141412","surface":"#1D1D1A","fg":"#EFEDE6","fg2":"#A39F93","line":"#2C2C27","accentSoft":"#6E6B61"},"font":{"heading":"Anton","body":"Work Sans"},"layout":{"radius":"0px","navHeight":{"desktop":"62px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":true,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","priser","boka","team","butik","korg","kassa","bekraftelse","galleri","journal","klubb","presentkort","event","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true),
  ('solsalt', 'Sol & Salt', '{"bransch":"florist","design_bransch":"florist","typ":"storefront","scope":"corevo-12"}'::jsonb, '{"color":{"primary":"#1F4F9C","primaryD":"#C2512E","bg":"#FAF3E1","surface":"#FFFCF2","fg":"#1E2B49","fg2":"#55523F","line":"#EADDBB","accentSoft":"#CBDCF6"},"font":{"heading":"DM Serif Display","body":"Figtree"},"layout":{"radius":"24px","navHeight":{"desktop":"68px","mobile":"56px"}},"caps":{"heroEyebrow":true,"homeStats":false,"homeGallery":false,"homeAbout":true}}'::jsonb, '["hem","butik","korg","kassa","bekraftelse","boka","kurser","galleri","blogg","klubb","offert","presentkort","om","kontakt"]'::jsonb, 'active', 1, 'corevo', true)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = excluded.status,
  contract_version = excluded.contract_version,
  owner = excluded.owner,
  selectable = excluded.selectable,
  replacement_key = null,
  updated_at = pg_catalog.now();

update public.verticals
   set default_template = 'ateljevinter',
       updated_at = pg_catalog.now()
 where key = 'florist';

update public.verticals
   set default_template = 'kalla',
       updated_at = pg_catalog.now()
 where key = 'frisör';

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.verticals'::pg_catalog.regclass
       and conname = 'verticals_default_template_fkey'
  ) then
    alter table public.verticals
      add constraint verticals_default_template_fkey
      foreign key (default_template)
      references public.templates(key)
      on update cascade
      on delete restrict;
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.template_slots'::pg_catalog.regclass
       and conname = 'template_slots_module_key_fkey'
  ) then
    alter table public.template_slots
      add constraint template_slots_module_key_fkey
      foreign key (module_key)
      references public.modules(key)
      on update cascade
      on delete restrict;
  end if;
end
$$;

insert into public.template_verticals (template_key, vertical_key)
select key, case when key in ('kalla', 'siluett', 'snitt') then 'frisör' else 'florist' end
from pg_catalog.unnest(array[
  'ateljevinter','aurora','blomstertorget','calytrix','eloria','lunaria',
  'onyx','sivsav','solsalt','kalla','siluett','snitt'
]) key
on conflict (template_key, vertical_key) do nothing;

insert into public.template_required_modules (template_key, module_key)
select themes.key, modules.module_key
from (
  values
    ('ateljevinter', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('aurora', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('blomstertorget', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('calytrix', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('eloria', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('lunaria', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('onyx', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('sivsav', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('solsalt', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort','kurser']::text[]),
    ('kalla', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort']::text[]),
    ('siluett', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort']::text[]),
    ('snitt', array['booking','shop','blogg','galleri','lojalitet','offert','presentkort']::text[])
) themes(key, required_modules)
cross join lateral pg_catalog.unnest(themes.required_modules) modules(module_key)
on conflict (template_key, module_key) do nothing;

insert into public.template_slots (
  template_key,
  section_key,
  slot_key,
  label,
  kind,
  repeatable,
  sort_order,
  default_kind,
  default_text
)
select
  themes.key,
  'hem',
  'copy.' || fields.field_key,
  fields.field_key,
  'text',
  false,
  fields.ordinality::integer,
  'text',
  null
from (
  values
    ('ateljevinter', array['pillar1Title','pillar1Body','pillar2Title','pillar2Body','pillar3Title','pillar3Body','shopEyebrow','shopTitle','shopCta','blogEyebrow','blogTitle','blogCta','homeGalleryEyebrow','galleryEyebrow','galleryTitle','clubEyebrow','clubTitle','clubLede','clubCta','clubNote']::text[]),
    ('aurora', array['shopEyebrow','shopTitle','shopCta','giftEyebrow','giftLede','giftCta','blogEyebrow','blogTitle','blogCta','contactEyebrow','contactTitle','galleryEyebrow','galleryTitle','galleryLede','clubEyebrow','clubTitle','clubLede','clubCta']::text[]),
    ('blomstertorget', array['findEyebrow','homeGalleryEyebrow','pillar1Title','pillar1Link','pillar2Title','pillar2Body','pillar2Link','pillar3Title','pillar3Body','pillar3Link','whyBody','whySub','shopEyebrow','shopTitle','shopCta','blogEyebrow','blogTitle','blogCta','contactTitle','contactEyebrow','galleryTitle','galleryLede','clubTitle','clubLede','clubEyebrow','clubCta']::text[]),
    ('calytrix', array['shopEyebrow','shopTitle','shopCta','findEyebrow','blogEyebrow','blogTitle','blogCta','closingTitle','closingLede','pillar1Title','pillar1Body','pillar2Title','pillar2Body','pillar3Title','pillar3Body','galleryTitle','galleryLede','clubTitle','clubLede','clubCta']::text[]),
    ('eloria', array['closingEyebrow','pillar1Title','pillar1Body','shopEyebrow','shopTitle','shopCta','blogEyebrow','blogTitle','blogCta','galleryEyebrow','galleryTitle','clubEyebrow','clubTitle','clubLede','clubNote','clubCta']::text[]),
    ('lunaria', array['pillar1Title','pillar1Body','pillar2Title','pillar2Body','pillar3Title','pillar3Body','homeGalleryEyebrow','shopEyebrow','shopTitle','shopCta','blogTitle','blogCta','galleryTitle','clubTitle','clubLede','clubCta']::text[]),
    ('onyx', array['findEyebrow','homeGalleryEyebrow','shopEyebrow','shopTitle','shopCta','pillar1Title','pillar1Body','pillar2Title','pillar2Body','pillar3Title','pillar3Body','blogEyebrow','blogTitle','blogCta','closingTitle','closingLede','galleryEyebrow','galleryTitle','clubEyebrow','clubTitle','clubLede','clubCta']::text[]),
    ('sivsav', array['pillar1Title','pillar1Body','pillar2Title','pillar2Body','pillar3Title','pillar3Body','homeGalleryEyebrow','shopEyebrow','shopTitle','shopCta','blogEyebrow','blogTitle','blogCta','galleryEyebrow','galleryTitle','clubEyebrow','clubTitle','clubLede','clubCta']::text[]),
    ('solsalt', array['aboutCopyHome','pillar1Title','pillar1Body','pillar2Title','pillar2Body','pillar3Title','pillar3Body','shopEyebrow','shopTitle','shopCta','blogTitle','blogCta','galleryTitle','clubTitle','clubLede','clubCta']::text[]),
    ('kalla', array['pillar1Title','pillar1Body','pillar2Title','pillar2Body','pillar3Title','pillar3Body','homeGalleryEyebrow','shopEyebrow','shopTitle','shopCta','blogTitle','blogCta','galleryEyebrow','galleryTitle','clubEyebrow','clubTitle','clubLede']::text[]),
    ('siluett', array['pillar1Title','pillar1Body','pillar2Title','pillar3Title','homeGalleryEyebrow','shopEyebrow','shopTitle','shopCta','blogTitle','blogCta','galleryEyebrow','galleryTitle','clubTitle','clubLede','clubNote','clubCta']::text[]),
    ('snitt', array['pillar1Title','pillar1Body','pillar2Title','findEyebrow','pillar3Title','servicesIntro','contactTitle','shopEyebrow','shopTitle','shopCta','blogEyebrow','blogTitle','blogCta','galleryEyebrow','galleryTitle','clubEyebrow','clubTitle','clubLede','clubNote','clubCta']::text[])
) themes(key, editor_fields)
cross join lateral pg_catalog.unnest(themes.editor_fields)
  with ordinality fields(field_key, ordinality)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key,
  label = excluded.label,
  kind = excluded.kind,
  repeatable = excluded.repeatable,
  sort_order = excluded.sort_order,
  default_kind = excluded.default_kind,
  default_text = excluded.default_text;

alter table public.template_verticals enable row level security;
alter table public.template_required_modules enable row level security;

drop policy if exists template_verticals_read on public.template_verticals;
create policy template_verticals_read on public.template_verticals
  for select to anon, authenticated
  using (true);

drop policy if exists template_required_modules_read
  on public.template_required_modules;
create policy template_required_modules_read
  on public.template_required_modules
  for select to anon, authenticated
  using (true);

revoke all on public.template_verticals, public.template_required_modules
  from public, anon, authenticated;
grant select on public.template_verticals, public.template_required_modules
  to anon, authenticated;
grant all on public.template_verticals, public.template_required_modules
  to service_role;

drop policy if exists templates_read_active on public.templates;
create policy templates_read_active on public.templates
  for select to anon, authenticated
  using (
    status in ('active', 'deprecated')
    or (select private.is_platform_admin())
  );

comment on table public.template_verticals is
  'Goal 93 typed projection from a Corevo theme to the platform vertical catalog.';
comment on table public.template_required_modules is
  'Goal 93 typed required-module projection for the code-owned theme catalog.';
comment on column public.templates.contract_version is
  '0 denotes an unversioned legacy row; Corevo 12 use catalog schema version 1.';
comment on column public.templates.selectable is
  'True only for active templates offered to new tenants and theme switches.';
