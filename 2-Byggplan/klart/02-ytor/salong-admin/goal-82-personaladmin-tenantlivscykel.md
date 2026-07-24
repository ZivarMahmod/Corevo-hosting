# Goal 82 — personaladmin och tenantlivscykel

**Status:** verifierat klart lokalt 2026-07-24
**Branch:** `codex/launch-inventory-customer-design`
**Databas:** `localhost-acceptance`; produktion är orörd

## Frysta beslut

- `Kunder` förblir basåtkomst för aktiv personal enligt nuvarande kanon.
- Tenantens läsvyer försvinner inte vid `provisioning`, `suspended` eller
  `deleted`; muterande tenantflöden ska däremot neka fail-closed.
- Verifierad platform-/partneroperatör får fortsätta använda sitt befintliga
  tenantscope. Ingen ny roll-, grant- eller statusmodell byggs.
- Ingen redesign av admin eller personalportalen.

## Verifierad acceptans

- [x] En gemensam servervakt kräver `tenant.status = active` före tenantägda
      mutationer, inklusive service-role-writes.
- [x] SECURITY DEFINER-flöden nekar tenantägda mutationer/publicering för
      `provisioning`, `suspended` och `deleted`.
- [x] `can_edit_site` fungerar från sidgrind genom serveraction och SQL-access.
- [x] Adminens genvägar visar bara ytor och åtgärder som användaren verkligen
      får använda.
- [x] Personalprofilen använder branschneutral befintlig personalcopy, aldrig
      hårdkodad `FRISÖR`.
- [x] Ägare, manager och personal behåller befintlig egen/delegerad kalender,
      kundbasåtkomst och platsgräns.

## Bevis

- RED→GREEN och riktad acceptans: 9 testfiler, 70 tester.
- Full websvit: 352 testfiler, 2 763 tester.
- Typecheck och Next-produktionsbuild passerar. Lint har 0 fel och 7 befintliga
  varningar utanför målet.
- Localhost startades om och svarade HTTP 200. `/admin` renderade
  `Översikt · Adminpanel`/`Översikt` utan horisontell overflow eller konsolfel
  på både `1440 × 900` och `390 × 844`; mobilvyn exponerade `Mobilnavigering`.
- Browsersessionen saknade tenantkoppling. Mutationsbeteendet verifierades
  därför av automatiska tester och preview-SQL, inte genom en browserwrite.
- `tenant_mutation_lifecycle_0130_test.sql` passerar mot preview och lämnar
  samtliga fixture-räkningar på noll efter rollback.
- Lifecycle-helpern har inget EXECUTE för `public`, `anon`, `authenticated`
  eller `service_role`, och dess `search_path` är tom.
- Oberoende slutgranskning: `SPEC PASS — CLEAN`.
- Slutlig `git diff --check` passerar efter dokumentationslåset.

## Låsgräns

Målet är 100 procent lokalt och arkiverat i den kanoniska ytmappen
`2-Byggplan/klart/02-ytor/salong-admin/`. Migration `0130` finns endast på
preview/lokalt; produktion har inte migrerats eller deployats.
