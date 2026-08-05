# AGENTS.md — Corevo

Detta är repots enda instruktionsfil för kodagenter. Skapa inte parallella
promptfiler eller underkatalogregler. Produktstatus finns i `HANDOFF.md` och
arkitekturkanon i
`1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`.

## Produktgräns

- Corevo är en generell multi-bransch-plattform: en kodbas, motor och datamodell.
- Frisör är en vertikal bland flera och får inte hårdkodas som standardfall.
- Moduler slås på per tenant. Tenant- och platsgränser ska alltid vara fail-closed.

## Säkerhet

- `corevo.se` är plattforms-/POS-host och får aldrig lösas som tenant-storefront.
- Följ `private.tenant_id()` och etablerad RLS. Kringgå aldrig tenantisolering i appkod.
- Personaldomänen heter `staff`/`staff_id`; skapa ingen parallell personmodell.
- Secrets, tokens och kunddata får aldrig skrivas till Git, loggar eller agentaktivitet.
- Ändra inte produktion, DNS, tunnlar, migrationsstatus, deploy eller remote branch utan
  uttryckligt godkännande.

## En ägare, ingen lagerkod

- Varje beteende, state och renderträd har exakt en kanonisk ägare.
- När resultatet ska ändras: ändra den befintliga ägaren. Lägg inte en wrapper,
  adapter, alternativ route, parallell komponent eller ny state-kopia ovanpå.
- Sök alltid efter befintlig implementation och alla anropare innan ny kod skrivs.
- `lib/` får inte importera UI-komponenter. Dela domänlogik och datamodeller, inte hela
  skärmar med olika auth- eller routeansvar.
- Vid cutover raderas ersatt kod, tester, CSS, feature flags, kommentarer och exports i
  samma ändring. Git är implementationens historik.
- Behåll kompatibilitetskod endast för ett faktiskt externt kontrakt, exempelvis en
  publicerad URL, lagrad data eller API-konsument. Skriv då vilket kontrakt som skyddas.
- Produktdata som kräver historik, audit, FK-integritet eller rättslig retention får
  mjukraderas. Det är en dataregel, inte ett krav att behålla död implementation.

## Verifiering

- Tester ska verifiera beteende genom verkliga kopplingsnoder: auth, routing, data,
  tenantgräns, tema, state samt server–client.
- Källtexttester får inte låsa filnamn, kodplacering, wrappers eller duplicerad JSX.
- En ersättning är inte klar förrän gamla produktionsimporter och onåbara grenar är
  borta och relevanta tester körts.
- För UI från ett uttryckligt Codex Design-paket i
  `4-Dokument-Underlag/01-acceptans/` är paketet exakt acceptanskanon. Läs hela det
  aktuella paketet och verifiera mekaniskt; improvisera inte.

Kör från `5-Kod/` efter ändringar:

```text
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Kör dessutom fokuserade tester för berörda kopplingsnoder. Databasverifiering ska vara
read-only om inte migration uttryckligen ingår i uppgiften.

## Filplacering

- Planering och arkitektur: `1-Planering/`
- Roadmap och aktiva byggbeslut: `2-Byggplan/`
- Research: `3-Bakgrund-Research/`
- Acceptans- och källunderlag: `4-Dokument-Underlag/`
- Kod och kod-dokumentation: `5-Kod/` respektive `5-Kod/docs/`
- Drift/runbooks: `5-Kod/docs/ops/`
- Manuella acceptansunderlag: `6-Testing/`

Roten innehåller bara `AGENTS.md`, `HANDOFF.md` och nödvändig repo-konfiguration.
