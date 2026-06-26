-- ============================================================================
-- 0040 — Salvia slots: reconcile till EN kanonisk slot-modell (option 4)
--
-- BAKGRUND: template_slots/content_slots seedades out-of-band (utanför migrations-
-- historiken) via 4-Dokument-Underlag/03-template-katalog/templates-import.sql →
-- 249 slots / 27 mallar i prod, varav salvia fick en GENERISK CMS-modell (19 slots:
-- hero.bg/services/team.member.{i}/gallery/contact/…). Det krockade med S2-editorns
-- region-modell. Beslut (Zivar 2026-06-26): EN slot-modell, kanonisk = S2-regionerna
-- (det render-bron ska rendera från), hubben skriver dit, den generiska retireras.
--
-- KANONISK KÄLLA för dessa rader = `lib/sajtbyggare/manifest/salvia.ts`
-- (SALVIA_REGION_MANIFEST). G1-regel: color/font är INTE slots (de bor i
-- templates.tokens + tenant_settings.branding) → bara region.type ∈ {text,image,logo}
-- blir template_slots. ⚠️ ÄNDRAS manifestet MÅSTE en ny migration följa — ett vitest
-- (lib/sajtbyggare/manifest/salvia-slots-canonical.test.ts) failar i CI annars.
--
-- PÅVERKAN: NOLL synlig storefront-effekt (publika sidan renderar från
-- tenant_settings/branding, inte content_slots — rendereraren = option 1, senare).
-- Bara super-admin-hubben (/salonger/[id]) listar/skriver dessa slots, och den är
-- data-driven → följer automatiskt. Endast SALVIA rörs (katalog-mallarna = goal-36).
-- ============================================================================

begin;

-- 1. Remappa LEVANDE tenant-innehåll FÖRE vi tar bort de gamla deklarationerna.
--    content_slots har ingen FK till template_slots (0026: bara tenant_id/asset_id),
--    slot_key är en lös referens → detta är en värde-remap, inga kaskader.
--    Generisk `hero.bg` (hero-bakgrund) → manifestets `hero.image` (hero-bild).
--    ANTAGANDE: samma visuella slot. `about.image` finns i BÅDA modellerna → orörd.
--    (Idag: exakt 2 salvia-content_slots, hero.bg + about.image — verifierat.)
update public.content_slots
   set slot_key = 'hero.image', updated_at = now()
 where template_key = 'salvia' and slot_key = 'hero.bg';

-- 2. Retira salvias generiska slot-deklarationer (de 19). Inga content_slots ligger
--    på de retirerade nycklarna (de 2 ovan är remappade/bevarade) → ingen dataförlust.
delete from public.template_slots where template_key = 'salvia';

-- 3. Deklarera de KANONISKA salvia-slottarna = SALVIA_REGION_MANIFEST (text+image+logo).
--    section_key ← nyckel-prefix; label = mänsklig (super-admin-drawer); default_text
--    lämnas NULL — React-layouten ger fortfarande THEME_CONTENT-defaults; rendereraren
--    (option 1) sätter defaults från THEME_CONTENT då (ingen duplicering/drift här).
insert into public.template_slots
  (template_key, section_key, slot_key, label, kind, asset_role, sort_order)
values
  ('salvia','hero',    'hero.eyebrow',  'Hero – ögonbryn',  'text', null,    0),
  ('salvia','hero',    'hero.title',    'Hero – rubrik',    'text', null,    1),
  ('salvia','hero',    'hero.lede',     'Hero – ingress',   'text', null,    2),
  ('salvia','hero',    'hero.image',    'Hero – bild',      'asset','image',  3),
  ('salvia','about',   'about.copy',    'Om oss – text',    'text', null,  100),
  ('salvia','about',   'about.italic',  'Om oss – kursiv',  'text', null,  101),
  ('salvia','about',   'about.image',   'Om oss – bild',    'asset','image',102),
  ('salvia','closing', 'closing.image', 'Avslutande bild',  'asset','image',200),
  ('salvia','footer',  'footer.tagline','Footer – slogan',  'text', null,  300),
  ('salvia','footer',  'logo',          'Logotyp',          'asset','logo', 301);

commit;
