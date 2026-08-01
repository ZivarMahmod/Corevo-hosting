# Goal 84 — låsbevis

Status: **100 % lokalt låst 2026-07-25**

Gren: `codex/launch-inventory-customer-design`
Databas: Supabase-preview `localhost-acceptance`
(`cwnhpesrgolflkmyjbrm`)
Produktion: orörd

## Färskt browserbevis

`node scripts/goal84-preview-acceptance.mjs --lock` kördes från tomt
Goal 84-fixtureläge och avslutades med:

```text
goal84: preview-browseracceptans LOCK OK
```

Körningen verifierade:

- Onboarding Studio skapade en webbplatskund med `booking=off`, publicerade den
  och lämnade bokningsgrunden tom.
- Onboarding Studio skapade en bokningskund med obligatorisk ägare.
- Superadmin sparade primärplatsens öppettider och bokningsregler.
- Tjänst, personal, tjänstekoppling, arbetstid och aktivering skapades genom
  produktens UI/server-actions.
- Readiness blockerade ofullständig grund och publicering gick genom den
  kanoniska databasspärren.
- Storefronten genomförde en riktig bokning med fyrsiffrig PIN via lokal
  minnesrelay; PIN lämnade inte relayprocessen.
- Bokningen fick rätt tenant, plats, tjänst och personal samt PIN- och
  bekräftelseoutbox.
- Bokningen avbokades genom produktflödet och är kvar som `cancelled`.
- Mobilsmoke 390×844 gav 0 px horisontell overflow och minst 44×44 px touchmål
  på öppettidskontrollerna.
- FreshCuts status, modulval och radantal var identiska före och efter körningen.

De två syntetiska, aktiva fixturekunderna behålls för senare samlad acceptans:
`goal84-webb-acceptans` och `goal84-acceptans`.

## Databasbevis

- `0132_tenant_launch_booking_tuple.sql` är applicerad på preview och dess
  positiva/negativa readinessfall är gröna.
- `0133_user_role_read_recursion.sql` är applicerad på preview.
- `user_role_read_recursion_0133_test.sql` kördes mot preview och slutade `DO`.
- Ägarprofil kan skapas av seedad global superadmin utan RLS-rekursion.
- Cross-tenant roll och roll över tillåten nivå nekas.
- Global, tenantskopad plattformsoperatör kan bekräfta platsöppettider; en
  oskopad aktör nekas fortfarande.
- Båda privata hjälpfunktionerna ägs av `postgres`, är `SECURITY DEFINER` och
  har tom `search_path`.
- Append-only-vakterna är åter aktiverade efter den exakta fixturestädningen.
- Security advisor: 0 error. Performance advisor: 0 error. Befintliga
  varningar är inte nya Goal 84-blockerare.

Den tillfälliga preview-hooken för testmejl är borttagen:
`hook_send_email_enabled=false`, hook-URI är tom, e-postgränsen är åter `2` och
det temporära schemat `goal84_acceptance` finns inte.

## Lokal kodverifiering

- Goal 84-scriptets syntaxkontroll: grön.
- Goal 84-scriptets self-test: grön.
- Fokuserade nya test: 3 filer / 11 test gröna.
- Full testsvit: 362 filer / 2 819 test gröna.
- `pnpm typecheck`: grön.
- `pnpm lint`: 0 fel, 7 sedan tidigare kända varningar.
- `pnpm build`: grön produktionsbuild.
- `git diff --check`: grön.

## Låsgräns

Goal 84 är färdig lokalt. Ingen produktion, extern transport eller nästa goal
startades i denna låsning.
