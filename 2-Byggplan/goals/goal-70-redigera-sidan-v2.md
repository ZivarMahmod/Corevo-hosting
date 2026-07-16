# Goal 70 — Kundadmin: Redigera sidan v2

**Skapad:** 2026-07-16  
**Status:** pågår  
**Kanon:** `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/03-redigera-sidan-v2/`  
**Plan:** `1-Planering/14-redigera-sidan-v2/IMPLEMENTATIONSPLAN.md`

## Mål

Bygg designpaketet som en exakt, tenantbunden editor i den delade Corevo-motorn. Ett klick på
`Redigera sidan` ska öppna editorn direkt. Alla befintliga fält ska finnas kvar, förhandsvisningen
ska reagera direkt och ändringar ska aldrig nå den publika sajten innan en atomisk publicering.

## Hårda acceptanskrav

- Paketets HTML och NOTES är visuell och funktionell lag. Ingen improviserad omdesign.
- Delad topnav och delad `SidaStudio`; ingen kund-, bransch- eller mallfork.
- Vänster panel är exakt 470 px på desktop. Mobilpreview är exakt 390 px och centrerad.
- Flikarna kommer från aktiv malls manifest. Kunden kan inte välja mall och ser ingen mallnyckel.
- Ett verkligt, beständigt utkast per tenant med optimistic locking.
- `Spara utkast` ändrar inte live. `Publicera` skriver hela revisionen atomiskt till live.
- Kasta utkast, återställ publicerad version, versionshistorik och lämna-vakt fungerar på riktigt.
- Desktop och mobil följer designens tokens, kontroller, status och panel/förhandsvisning-flöde.
- Mekaniskt `0 FAIL` i `03-redigera-sidan-v2.accept.spec.ts` och `probe.mjs`.
- Typecheck, enhetstester, build, oberoende review och prod-smoke är gröna.

## Säkerhet och data

- Tenantgräns genom `private.tenant_id()`/organisationsscope.
- RLS plus explicita grants. `anon` får ingen åtkomst till privata revisioner.
- Publicerad storefront fortsätter läsa enbart publicerade live-tabeller.
- Media får laddas upp till R2 under utkast men gamla live-referenser tas inte bort före publicering.
- Tjänster, priser, betyg, blogg, butik och personal är hämtad data med länkar till sina ägande ytor;
  editorn muterar dem inte.
- Ingen muterande acceptanstest mot produktion.

## Klar-definition

Goal är inte klar förrän ändringen är verifierad och driftsatt. Då flyttas detta dokument till
`2-Byggplan/klart/02-ytor/salong-admin/` och designpaketet till
`4-Dokument-Underlag/01-acceptans/Dagens genomgångar/klar/03-redigera-sidan-v2/`.
