# goal-76 — Provisionering, readiness och säker publicering

> Startad 2026-07-23 efter Zivars godkännande. Goal-74:s och Goal-75:s
> produktionssteg är fortsatt parkerade till den gemensamma releasefasen. Goal-76
> byggs och accepteras i samma worktree mot Supabase-previewbranchen
> `localhost-acceptance`; ingen produktionsdeploy ingår.

## Mål

En ny kund ska skapas som **Under konfiguration** och får inte bli publik förrän
databasen har verifierat att de krav som gäller för kundens aktiva moduler är
uppfyllda. Publicering ska vara en enda serverägd, atomisk övergång till
`active`. Plattformen ska visa exakt vad som saknas och använda en enda
kanonisk standardadress: `<slug>.boka.corevo.se`.

## Beslut

- `createTenant` provisionerar tenant, settings, primär plats, roller, moduler
  och eventuell ägare/tjänst men lämnar alltid status `provisioning`.
- Standardadressen skapas inte per tenant i Cloudflare. Den befintliga isolerade
  wildcard-routen `*.boka.corevo.se/*` är den kanoniska infrastrukturen.
- En verifierad egen domän får fortsätta vinna som publik adress.
- Gamla `<slug>.corevo.se` kan ligga kvar som uttryckliga legacyalias, men ny kod,
  onboarding och smoke får inte behandla dem som kanon.
- Databasen äger readiness och blockerar varje övergång till `active` som försöker
  gå runt publiceringsfunktionen.
- Readiness är modulstyrd. Bokningskraven gäller endast när
  `tenant_modules.booking.state = 'live'`.
- Ingen ny onboardingmotor, kö, Worker eller parallell statusmodell skapas.

## Readiness

Alla tenants behöver:

- tenant-settings,
- aktiv primär plats,
- ett aktivt ägarkonto med rollen `salon_admin`,
- en giltig kanonisk host härledd från tenantens slug.

När bokningsmodulen är live behövs dessutom:

- minst en aktiv tjänst som kan bokas på den primära platsen,
- minst en aktiv personal på den primära platsen,
- minst en giltig koppling mellan den personalen och en bokningsbar tjänst,
- minst en arbetstidsrad för bokningsbar personal på platsen,
- minst en bekräftad öppettidsrad för platsen.

## Acceptans

- En ny kund stannar i `provisioning` efter lyckat skapande.
- Publik RLS fortsätter dölja kunden tills publiceringen har lyckats.
- Adminlistan och kundkortet visar **Under konfiguration**, inte
  **Aktiv & publik**.
- Kundkortet visar samma readiness-sanning som databasen och namnger varje sak
  som saknas.
- Publiceringsknappen är spärrad när readiness är röd.
- Databasen nekar direkt eller konkurrerande `status='active'` när ett krav
  saknas.
- Publiceringsanropet kan upprepas utan att skapa dubbla event eller halvstatus.
- Bokningskrav hoppas över när bokningsmodulen inte är live.
- Alla nya standardlänkar visar `<slug>.boka.corevo.se`; localhostlänkar får
  använda den befintliga `?tenant=<slug>`-sömmen för lokal acceptans.
- Domänsmoke provar den kanoniska bokningshosten och godkänner inte 404/5xx som
  ett fungerande svar.
- POS-hostar och reserverade root-subdomäner påverkas inte.

## Verifiering

- Riktad RED→GREEN för URL-builder, create-flöde, readiness-RPC,
  aktiveringsvakt och adminpresentation.
- Migrationen körs och runtimeverifieras på `localhost-acceptance`, aldrig mot en
  lokal Supabase-instans.
- En transaktionsisolerad preview-fixture provas i ordningen
  redo → publicera → idempotent ompublicering → ta bort krav → nekad publicering.
- En enda negativ runtimekontroll bevisar att publicering före readiness nekas.
- Riktade tester, full websvit, typecheck, lint, build och `git diff --check`.

## Status

- [x] Scope och minsta design godkänd
- [x] Kod- och databasflöde kartlagt
- [x] RED-test för kanonisk host och provisioning
- [x] Readiness-/publiceringsmigration skapad med Supabase CLI
- [x] Adminpresentation och publiceringskontroll implementerad
- [x] Previewbranch migrerad och runtimeverifierad
- [ ] Gemensam localhostacceptans genomförd
- [ ] Produktionsmigration/host/deploy — parkerad till gemensam release

## Lokal låsning 2026-07-23

Goal-76:s kod och databasgrind är lokalt låsta. Previewbranchen
`localhost-acceptance` har migration `20260723111315`; runtimeprovet verifierar
lyckad publicering, idempotens, nekad för tidig publicering och nekad direkt
statusbypass utan bestående teständringar. Standard- och E2E-seeden är rättade
så superadmin är en global identitet och tenant skapas i `provisioning` innan
den går genom samma DB-vakt.

Automatisk verifiering:

- 343/343 testfiler och 2 714/2 714 tester gröna före seedregressionen,
- separat seed-/readinessregression 6/6 grön,
- typecheck och lint gröna,
- Next-produktionsbuild grön,
- `git diff --check` utan whitespacefel.

Den gemensamma browseracceptansen är avsiktligt kvar: localhostprocessen som
redan kör på port 3000 använder produktionens `.env.production`, så ingen
skrivande adminacceptans kördes där. Den görs senare med previewmiljön tillsammans
med Goal-74 och Goal-75, enligt Zivars releasebeslut.
