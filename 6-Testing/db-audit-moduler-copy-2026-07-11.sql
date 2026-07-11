-- DB-AUDIT 2026-07-11 — moduler/kurser/copy-kedjan (goal-59)
-- Körs i Supabase SQL-editorn (läser bara, ändrar inget).
-- Varje rad i resultatet = en check. status 'OK' = friskt, annars åtgärd.

with copy_whitelist as (
  select array[
    'heroEyebrow','heroTitle','heroLede','aboutCopy','aboutCopyHome','tagline','italic','aboutTitle',
    'homeSecondTitle','whyTitle','whySub','whyBody','servicesEyebrow','servicesTitle','servicesIntro',
    'teamEyebrow','teamTitle','teamLead','closingEyebrow','closingTitle','closingLede',
    'contactEyebrow','contactTitle',
    'pillar1Title','pillar1Body','pillar1Link','pillar2Title','pillar2Body','pillar2Link',
    'pillar3Title','pillar3Body','pillar3Link','shopEyebrow','shopTitle','shopCta',
    'blogEyebrow','blogTitle','blogCta','giftEyebrow','giftLede','giftCta',
    'galleryEyebrow','findEyebrow'
  ] as keys
)

-- 1. Modul-katalogen: exakt de 8 nycklar koden gate:ar på?
select '1. modules-katalog' as check_,
       case when array_agg(key order by key) = array['blogg','booking','kurser','lojalitet','media_library','offert','presentkort','shop']
            then 'OK' else 'AVVIKELSE: ' || string_agg(key, ', ' order by key) end as status
from public.modules

union all
-- 2. tenant_modules med nyckel utanför katalogen (död rad)
select '2. tenant_modules döda nycklar',
       coalesce('DÖDA: ' || string_agg(distinct tm.module_key, ', '), 'OK')
from public.tenant_modules tm
left join public.modules m on m.key = tm.module_key
where m.key is null

union all
-- 3. kurser-modulen efter 0056: vilka kunder har den, i vilket läge?
select '3. kurser per kund',
       coalesce(string_agg(t.slug || '=' || tm.state, ', '), 'INGEN RAD (0056 ej körd?)')
from public.tenant_modules tm
join public.tenants t on t.id = tm.tenant_id
where tm.module_key = 'kurser'

union all
-- 4. verticals.default_modules-nycklar som inte finns i katalogen (gör inget vid onboarding)
select '4. bransch-förval döda modulnycklar',
       coalesce('DÖDA: ' || string_agg(distinct v.key || '→' || k.k, ', '), 'OK')
from public.verticals v, lateral jsonb_object_keys(coalesce(v.default_modules,'{}'::jsonb)) k(k)
left join public.modules m on m.key = k.k
where m.key is null

union all
-- 5. florist-branschen: finns raden + har kurser-förval + mall-text?
select '5. florist-bransch',
       coalesce((select 'finns · kurser=' || coalesce(default_modules->>'kurser','SAKNAS')
                     || ' · mall-textnycklar=' || (select count(*) from jsonb_object_keys(coalesce(default_copy,'{}'::jsonb)))::text
                 from public.verticals where key='florist'), 'SAKNAS HELT')

union all
-- 6. verticals.default_copy-nycklar utanför kodens whitelist (sparas men läses aldrig)
select '6. bransch-mall döda copy-nycklar',
       coalesce('DÖDA: ' || string_agg(v.key || '→' || k.k, ', '), 'OK')
from public.verticals v, lateral jsonb_object_keys(coalesce(v.default_copy,'{}'::jsonb)) k(k), copy_whitelist w
where k.k <> all (w.keys)

union all
-- 7. kunders settings.copy-nycklar utanför whitelisten (läses aldrig = död text)
select '7. kund-copy döda nycklar',
       coalesce('DÖDA: ' || string_agg(distinct t.slug || '→' || k.k, ', '), 'OK')
from public.tenant_settings ts
join public.tenants t on t.id = ts.tenant_id, lateral jsonb_object_keys(coalesce(ts.settings->'copy','{}'::jsonb)) k(k), copy_whitelist w
where k.k <> all (w.keys)

union all
-- 8. gamla "Kurs:"-tjänster (skulle vara avaktiverade — kurser är egen modul nu)
select '8. Kurs:-prefixade tjänster',
       coalesce(string_agg(t.slug || ': ' || s.name || ' (' || case when s.active then 'AKTIV!' else 'inaktiv' end || ')', ', '), 'OK — inga')
from public.services s join public.tenants t on t.id = s.tenant_id
where s.name like 'Kurs:%'

union all
-- 9. tenant_events hos kunder som INTE har kurser-modulen (osynlig data)
select '9. events utan kurser-modul',
       coalesce('OSYNLIGA: ' || string_agg(distinct t.slug, ', '), 'OK')
from public.tenant_events e
join public.tenants t on t.id = e.tenant_id
left join public.tenant_modules tm on tm.tenant_id = e.tenant_id and tm.module_key = 'kurser' and tm.state in ('live','paused','draft')
where tm.id is null

union all
-- 10. event_registrations vars event är borta (föräldralösa)
select '10. föräldralösa kursanmälningar',
       coalesce(count(*)::text || ' st', 'OK')
from public.event_registrations r
left join public.tenant_events e on e.id = r.event_id
where e.id is null

union all
-- 11. verticals.default_template som inte är ett riktigt tema (död pekare)
select '11. bransch default_template',
       coalesce(string_agg(v.key || '=' || v.default_template, ', '), 'alla null')
from public.verticals v where v.default_template is not null;
