-- Corevo multi-bransch — mall-import (genererad av _import_templates.js, READ-ONLY)
-- IDEMPOTENT: on conflict do update. status=draft. Rör EJ salvia (active).
-- Granska innan apply. Applicera via Supabase MCP mot prod (clylvowtowbtotrahuad).
begin;

-- ===== haircut  (frisör/storefront, licens=kräver-kredit) =====
insert into templates (key, name, tags, tokens, sections, status) values (
  'haircut', 'Corevo Haircut', '{"bransch":"frisör","typ":"storefront","stil":"bold","licens":"kräver-kredit","scope":"internal"}'::jsonb, '{"color":{"primary":"#eb1616","secondary":"#191c24","accent":"#191c24","bg":null,"surface":null,"text":"#000000","muted":null},"font":{"heading":"Roboto","body":"Oswald"},"layout":{"max_width":null,"border_radius":null,"nav_position":"sticky"}}'::jsonb, array['hero','services','team','testimonials','footer']::text[], 'draft'
)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = case when templates.status = 'active' then templates.status else 'draft' end
where templates.key <> 'salvia';

insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'hero', 'hero.bg', 'Hero – bakgrundsbild', 'asset', 'image', '16:9', null, null, false, 0, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'hero', 'hero.heading', 'Hero – rubrik', 'text', null, null, null, null, false, 1, 'text', 'Välkommen', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'hero', 'hero.subheading', 'Hero – underrubrik', 'text', null, null, null, null, false, 2, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'services', 'services.heading', 'Tjänster – rubrik', 'text', null, null, null, null, false, 100, 'text', 'Våra tjänster', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'services', 'services.list', 'Tjänster – tjänstelista (boknings-modul)', 'module', null, null, 'booking', 'service_list', false, 101, null, null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'team', 'team.heading', 'Team – rubrik', 'text', null, null, null, null, false, 200, 'text', 'Vårt team', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'team', 'team.member.{i}.photo', 'Medarbetare – bild', 'asset', 'image', '1:1', null, null, true, 201, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'team', 'team.member.{i}.name', 'Medarbetare – namn', 'text', null, null, null, null, true, 202, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'team', 'team.member.{i}.role', 'Medarbetare – titel', 'text', null, null, null, null, true, 203, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'testimonials', 'testimonials.heading', 'Omdömen – rubrik', 'text', null, null, null, null, false, 300, 'text', 'Vad våra kunder säger', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'testimonials', 'testimonials.item.{i}.quote', 'Omdöme – citat', 'text', null, null, null, null, true, 301, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'testimonials', 'testimonials.item.{i}.author', 'Omdöme – person', 'text', null, null, null, null, true, 302, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'testimonials', 'testimonials.item.{i}.photo', 'Omdöme – porträtt', 'asset', 'image', '1:1', null, null, true, 303, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'footer', 'footer.logo', 'Sidfot – logotyp', 'asset', 'logo', null, null, null, false, 400, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'haircut', 'footer', 'footer.text', 'Sidfot – text', 'text', null, null, null, null, false, 401, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;

-- ===== training-studio  (frisör/storefront, licens=kräver-kredit) =====
insert into templates (key, name, tags, tokens, sections, status) values (
  'training-studio', 'Corevo Training Studio', '{"bransch":"frisör","typ":"storefront","stil":"modern","licens":"kräver-kredit","scope":"internal"}'::jsonb, '{"color":{"primary":"#ed563b","secondary":"#232d39","accent":"#232d39","bg":null,"surface":null,"text":null,"muted":null},"font":{"heading":"Poppins","body":"Poppins"},"layout":{"max_width":"1200px","border_radius":"5px","nav_position":"sticky"}}'::jsonb, array['hero','services','cta','booking','contact','footer']::text[], 'draft'
)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = case when templates.status = 'active' then templates.status else 'draft' end
where templates.key <> 'salvia';

insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'hero', 'hero.bg', 'Hero – bakgrundsbild', 'asset', 'image', '16:9', null, null, false, 0, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'hero', 'hero.heading', 'Hero – rubrik', 'text', null, null, null, null, false, 1, 'text', 'Välkommen', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'hero', 'hero.subheading', 'Hero – underrubrik', 'text', null, null, null, null, false, 2, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'services', 'services.heading', 'Tjänster – rubrik', 'text', null, null, null, null, false, 100, 'text', 'Våra tjänster', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'services', 'services.item.{i}.icon', 'Tjänst – ikon/bild', 'asset', 'image', '1:1', null, null, true, 101, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'services', 'services.item.{i}.title', 'Tjänst – titel', 'text', null, null, null, null, true, 102, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'services', 'services.item.{i}.text', 'Tjänst – beskrivning', 'text', null, null, null, null, true, 103, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'cta', 'cta.heading', 'CTA – rubrik', 'text', null, null, null, null, false, 200, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'cta', 'cta.text', 'CTA – text', 'text', null, null, null, null, false, 201, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'booking', 'booking.heading', 'Boka – rubrik', 'text', null, null, null, null, false, 300, 'text', 'Boka tid', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'booking', 'booking.widget', 'Boka – boknings-modul', 'module', null, null, 'booking', 'booking_cta', false, 301, null, null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'contact', 'contact.heading', 'Kontakt – rubrik', 'text', null, null, null, null, false, 400, 'text', 'Kontakt', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'contact', 'contact.address', 'Kontakt – adress/text', 'text', null, null, null, null, false, 401, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'contact', 'contact.map', 'Kontakt – karta/bild', 'asset', 'image', '16:9', null, null, false, 402, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'footer', 'footer.logo', 'Sidfot – logotyp', 'asset', 'logo', null, null, null, false, 500, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'training-studio', 'footer', 'footer.text', 'Sidfot – text', 'text', null, null, null, null, false, 501, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;

-- ===== studio  (frisör/storefront, licens=kräver-kredit) =====
insert into templates (key, name, tags, tokens, sections, status) values (
  'studio', 'Corevo Studio', '{"bransch":"frisör","typ":"storefront","stil":"minimal","licens":"kräver-kredit","scope":"internal"}'::jsonb, '{"color":{"primary":"#d62d20","secondary":"#0057e7","accent":"#0057e7","bg":null,"surface":null,"text":null,"muted":null},"font":{"heading":"Poppins","body":"Poppins"},"layout":{"max_width":"1199px","border_radius":"6px","nav_position":"top"}}'::jsonb, array['hero','contact','footer']::text[], 'draft'
)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = case when templates.status = 'active' then templates.status else 'draft' end
where templates.key <> 'salvia';

insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'studio', 'hero', 'hero.bg', 'Hero – bakgrundsbild', 'asset', 'image', '16:9', null, null, false, 0, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'studio', 'hero', 'hero.heading', 'Hero – rubrik', 'text', null, null, null, null, false, 1, 'text', 'Välkommen', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'studio', 'hero', 'hero.subheading', 'Hero – underrubrik', 'text', null, null, null, null, false, 2, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'studio', 'contact', 'contact.heading', 'Kontakt – rubrik', 'text', null, null, null, null, false, 100, 'text', 'Kontakt', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'studio', 'contact', 'contact.address', 'Kontakt – adress/text', 'text', null, null, null, null, false, 101, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'studio', 'contact', 'contact.map', 'Kontakt – karta/bild', 'asset', 'image', '16:9', null, null, false, 102, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'studio', 'footer', 'footer.logo', 'Sidfot – logotyp', 'asset', 'logo', null, null, null, false, 200, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'studio', 'footer', 'footer.text', 'Sidfot – text', 'text', null, null, null, null, false, 201, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;

-- ===== star-admin2  (generell/admin, licens=fri) =====
insert into templates (key, name, tags, tokens, sections, status) values (
  'star-admin2', 'Corevo Star Admin2', '{"bransch":"generell","typ":"admin","stil":"clean","licens":"fri","scope":"public"}'::jsonb, '{"color":{"primary":"#1f3bb3","secondary":"#f1f1f1","accent":"#f1f1f1","bg":null,"surface":"#ffffff","text":"#0f1531","muted":"#434a54"},"font":{"heading":null,"body":"var(--bs-font-sans-serif)"},"layout":{"max_width":"1320px","border_radius":"8px","nav_position":"side"}}'::jsonb, array['dashboard']::text[], 'draft'
)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = case when templates.status = 'active' then templates.status else 'draft' end
where templates.key <> 'salvia';

insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'star-admin2', 'dashboard', 'dashboard.logo', 'Logotyp', 'asset', 'logo', null, null, null, false, 0, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'star-admin2', 'dashboard', 'dashboard.title', 'Panel – titel', 'text', null, null, null, null, false, 1, 'text', 'Översikt', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;

-- ===== sneat  (generell/admin, licens=fri) =====
insert into templates (key, name, tags, tokens, sections, status) values (
  'sneat', 'Corevo Sneat', '{"bransch":"generell","typ":"admin","stil":"clean","licens":"fri","scope":"public"}'::jsonb, '{"color":{"primary":null,"secondary":null,"accent":null,"bg":null,"surface":null,"text":null,"muted":null},"font":{"heading":"Open Sans","body":"Open Sans"},"layout":{"max_width":null,"border_radius":null,"nav_position":null}}'::jsonb, array['dashboard']::text[], 'draft'
)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = case when templates.status = 'active' then templates.status else 'draft' end
where templates.key <> 'salvia';

insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'sneat', 'dashboard', 'dashboard.logo', 'Logotyp', 'asset', 'logo', null, null, null, false, 0, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'sneat', 'dashboard', 'dashboard.title', 'Panel – titel', 'text', null, null, null, null, false, 1, 'text', 'Översikt', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;

-- ===== connect-plus  (generell/storefront, licens=fri) =====
insert into templates (key, name, tags, tokens, sections, status) values (
  'connect-plus', 'Corevo Connect Plus', '{"bransch":"generell","typ":"storefront","stil":"clean","licens":"fri","scope":"public"}'::jsonb, '{"color":{"primary":"#0062ff","secondary":"#8e94a9","accent":"#8e94a9","bg":null,"surface":"#ffffff","text":"#0f1531","muted":"#434a54"},"font":{"heading":"nunito-regular","body":null},"layout":{"max_width":"1140px","border_radius":"0.25rem","nav_position":"fixed-top"}}'::jsonb, array['hero','footer']::text[], 'draft'
)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = case when templates.status = 'active' then templates.status else 'draft' end
where templates.key <> 'salvia';

insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'connect-plus', 'hero', 'hero.bg', 'Hero – bakgrundsbild', 'asset', 'image', '16:9', null, null, false, 0, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'connect-plus', 'hero', 'hero.heading', 'Hero – rubrik', 'text', null, null, null, null, false, 1, 'text', 'Välkommen', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'connect-plus', 'hero', 'hero.subheading', 'Hero – underrubrik', 'text', null, null, null, null, false, 2, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'connect-plus', 'footer', 'footer.logo', 'Sidfot – logotyp', 'asset', 'logo', null, null, null, false, 100, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'connect-plus', 'footer', 'footer.text', 'Sidfot – text', 'text', null, null, null, null, false, 101, 'text', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;

-- ===== celestial-admin  (generell/admin, licens=fri) =====
insert into templates (key, name, tags, tokens, sections, status) values (
  'celestial-admin', 'Corevo Celestial Admin', '{"bransch":"generell","typ":"admin","stil":"dark","licens":"fri","scope":"public"}'::jsonb, '{"color":{"primary":"#f2125e","secondary":"#392ccd","accent":"#392ccd","bg":null,"surface":"#ffffff","text":"#0f1531","muted":"#434a54"},"font":{"heading":null,"body":null},"layout":{"max_width":"1140px","border_radius":"0.25rem","nav_position":"side"}}'::jsonb, array['dashboard']::text[], 'draft'
)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = case when templates.status = 'active' then templates.status else 'draft' end
where templates.key <> 'salvia';

insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'celestial-admin', 'dashboard', 'dashboard.logo', 'Logotyp', 'asset', 'logo', null, null, null, false, 0, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'celestial-admin', 'dashboard', 'dashboard.title', 'Panel – titel', 'text', null, null, null, null, false, 1, 'text', 'Översikt', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;

-- ===== breeze-admin  (generell/admin, licens=fri) =====
insert into templates (key, name, tags, tokens, sections, status) values (
  'breeze-admin', 'Corevo Breeze Admin', '{"bransch":"generell","typ":"admin","stil":"clean","licens":"fri","scope":"public"}'::jsonb, '{"color":{"primary":null,"secondary":null,"accent":null,"bg":null,"surface":null,"text":null,"muted":null},"font":{"heading":null,"body":null},"layout":{"max_width":null,"border_radius":null,"nav_position":"side"}}'::jsonb, array['dashboard']::text[], 'draft'
)
on conflict (key) do update set
  name = excluded.name,
  tags = excluded.tags,
  tokens = excluded.tokens,
  sections = excluded.sections,
  status = case when templates.status = 'active' then templates.status else 'draft' end
where templates.key <> 'salvia';

insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'breeze-admin', 'dashboard', 'dashboard.logo', 'Logotyp', 'asset', 'logo', null, null, null, false, 0, 'asset', null, null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;
insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (
  'breeze-admin', 'dashboard', 'dashboard.title', 'Panel – titel', 'text', null, null, null, null, false, 1, 'text', 'Översikt', null
)
on conflict (template_key, slot_key) do update set
  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,
  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,
  module_key = excluded.module_key, module_view = excluded.module_view,
  repeatable = excluded.repeatable, sort_order = excluded.sort_order,
  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;

commit;
