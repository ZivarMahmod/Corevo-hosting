-- ▸ FIL: 0066_branscher_atelje_verkstad_radgivning.sql
-- ▸ (döp SQL-Editor-fliken till detta — Supabase kallar den annars "Untitled query")

-- 0066 — goal-67: de branscher Zivar kräver stöd för men som aldrig seedats.
--
-- Motorn har ALDRIG blockerat dem (kalendern läser tid, inte bransch — bevisat i
-- lib/admin/bransch-kalender.test.ts). De saknades bara som rader. En bransch utan rad
-- går inte att välja i onboardingen, så "stöds inte" och "är inte seedad" har sett
-- likadana ut utifrån. Nu skiljs de åt.
--
-- default_template = 'edit' (den generella mallen). De här branscherna har ingen egen
-- mall än; 'edit' är neutral och bär ingen frisör-vokabulär. När en riktig kund dyker
-- upp får branschen en egen mall — mallen äger formen (vektor-regeln, goal-59).
--
-- terminology: ORDEN är det enda som skiljer branscherna i motorn (se
-- 1-Planering/01-arkitektur/bransch-lagret-bokning.md §3). Svensk plural gissas ALDRIG
-- av termPlural — den kräver <key>_plural. Därför sätts *_plural explicit där ordet är
-- oregelbundet.
--
-- default_modules: booking live överallt. shop bara där varor faktiskt säljs (ateljé,
-- tatuering säljer inte varor över disk → off). off→på kräver plattformsadmin (0026),
-- så 'off' är en enkelriktad dörr — därför 'draft' där modulen kan bli aktuell.
--
-- Idempotent (on conflict do update) — kör om den fritt.

insert into public.verticals (key, name, default_modules, default_template, terminology, rules)
values
  -- ── Ateljé (Zivars prio 3) ────────────────────────────────────────────────
  -- Formgivaren tar emot på besök. "Ateljébesök" är tjänsten, inte "behandling".
  (
    'ateljé',
    'Ateljé',
    '{"booking":"live","loyalty":"draft","shop":"draft"}'::jsonb,
    'edit',
    '{"staff":"Formgivare","staff_plural":"Formgivare","service":"Ateljébesök","business":"Ateljé","unit":"plats"}'::jsonb,
    '{}'::jsonb
  ),

  -- ── Tatueringsstudio ──────────────────────────────────────────────────────
  -- Sessionen är lång och bokas ofta efter konsultation. Ordet är "session",
  -- aldrig "behandling" (fel register) och absolut aldrig "klippning".
  (
    'tatueringsstudio',
    'Tatueringsstudio',
    '{"booking":"live","loyalty":"draft","shop":"off"}'::jsonb,
    'edit',
    '{"staff":"Tatuerare","staff_plural":"Tatuerare","service":"Session","business":"Studio","unit":"plats"}'::jsonb,
    '{}'::jsonb
  ),

  -- ── Verkstad (cykel, bil, mek) ────────────────────────────────────────────
  -- OBS: verkstaden bokar MEKANIKERN (eller lyften) — inte cykeln. Objektet som
  -- lämnas in är vad jobbet HANDLAR OM, inte vad som upptar tiden. Objekt-entiteten
  -- är därför ett eget gap (GAP 2, se arkitekturkartan) och löses INTE här. Den här
  -- raden ger verkstaden orden; historiken på objektet kommer sen.
  (
    'verkstad',
    'Verkstad',
    '{"booking":"live","loyalty":"off","shop":"draft"}'::jsonb,
    'edit',
    '{"staff":"Mekaniker","staff_plural":"Mekaniker","service":"Arbete","business":"Verkstad","unit":"plats"}'::jsonb,
    '{}'::jsonb
  ),

  -- ── Ekonomibyrå ───────────────────────────────────────────────────────────
  -- Bokar ett MÖTE. Kunden väljer ofta ingen person alls. Motorn kräver idag en
  -- resursrad (staff_id NOT NULL bär krockskyddet) → byrån lägger upp "Rådgivning"
  -- som resurs. Fungerar, men är en workaround: se GAP 1 i arkitekturkartan.
  (
    'ekonomibyrå',
    'Ekonomibyrå',
    '{"booking":"live","loyalty":"off","shop":"off"}'::jsonb,
    'edit',
    '{"staff":"Rådgivare","staff_plural":"Rådgivare","service":"Möte","business":"Byrå","unit":"plats"}'::jsonb,
    '{}'::jsonb
  ),

  -- ── Rådgivning (fristående konsult/coach) ─────────────────────────────────
  (
    'rådgivning',
    'Rådgivning',
    '{"booking":"live","loyalty":"off","shop":"off"}'::jsonb,
    'edit',
    '{"staff":"Rådgivare","staff_plural":"Rådgivare","service":"Möte","business":"Mottagning","unit":"plats"}'::jsonb,
    '{}'::jsonb
  )
on conflict (key) do update
  set name             = excluded.name,
      default_modules  = excluded.default_modules,
      default_template = excluded.default_template,
      terminology      = excluded.terminology,
      updated_at       = now();

-- ── Florist saknade sitt tjänste-ord ────────────────────────────────────────
-- En florists tjänst hette "Tjänst" i hela admin (plattformens neutrala fallback),
-- för att florist-raden aldrig fått en `service`-nyckel. Det är en riktig läcka mot
-- en LEVANDE kund (Hantverksfloristerna). Vi rör bara den saknade nyckeln — resten
-- av florist-raden lämnas som den är.
update public.verticals
   set terminology = terminology || '{"service":"Beställning"}'::jsonb,
       updated_at  = now()
 where key = 'florist'
   and terminology->>'service' is null;
