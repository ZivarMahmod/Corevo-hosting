# Goal 89 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Samordna publik storefront och preview genom ett gemensamt modul- och mallslottskontrakt.

**Architecture:** Behåll modulernas befintliga loaders och states. Lyft endast den gemensamma metadata-, navigations- och teaserlogiken till React-fria helpers som båda ytorna läser. Mallarna renderar fasta slots och faller tillbaka till generisk modulvy när specialvy saknas.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Playwright, Supabase/RLS som befintligt runtimekontrakt.

## Globala begränsningar

- Ingen ny dependency.
- Ingen ny parallell modulstate eller loader.
- Ingen fri drag-and-drop-builder.
- Ingen produktionsdatabas och ingen produktiondeploy.
- `preview` får läsa draft/template-läge men får aldrig skriva publicerat innehåll.
- `live`, `paused`, `draft` och `off` ska behålla sina befintliga betydelser.

## Fastställda tekniska kontrakt

- Katalogägare: `components/storefront/layouts/module-navigation.ts`.
- Dataformat: befintlig `LayoutModuleTeasers`.
- Gemensam läsare: befintlig `loadLayoutModuleTeasers`.
- Generisk fallback: befintlig `StorefrontModuleSections`, med `variant="teaser"`
  på startsidan och `variant="full"` på modulens egen sida.
- Gemensam routegate: `moduleNavigationLinks`, `moduleRouteReachable` och
  `canonicalModuleHref`.
- Preview-acceptans: `/salong-preview/[slug]` med befintliga `theme` och `copy`.

## Förväntade kodytor

Verifiera exakta radnummer före kodändring. Följande ytor är den avsedda sömmen:

- `5-Kod/apps/web/components/storefront/layouts/load-module-teasers.ts`
- `5-Kod/apps/web/components/storefront/layouts/module-navigation.ts`
- `5-Kod/apps/web/components/storefront/StorefrontModuleSections.tsx`
- `5-Kod/apps/web/app/(public)/layout.tsx`
- `5-Kod/apps/web/app/salong-preview/[slug]/page.tsx`
- `5-Kod/apps/web/app/salong-preview/[slug]/preview-shell.tsx`
- befintliga theme-registryfiler under `5-Kod/apps/web/components/storefront/layouts/`
- befintliga tester nära dessa helpers och `5-Kod/e2e/`

## Task 1 — lås katalogkontraktet

- [ ] Skriv först ett test som kräver en React-fri katalog för modulnyckel,
  route, etikett, reachable-regel och fallbacktyp.
- [ ] Utöka `module-navigation.ts` och behåll dess exports som den gemensamma
  route-/CTA-gaten; skapa ingen parallell katalogfil.
- [ ] Testa minst `booking`, `shop`, `blogg`, `kurser`, `offert`, `presentkort`,
  `lojalitet` och `galleri`.
- [ ] Testa att okänd modul eller ogiltig route faller bort utan exception.

## Task 2 — förena preview och publik loader

- [ ] Lägg ett regressionstest som jämför modul-teasers och navlänkar från
  preview och publik layout för samma tenant och samma module states.
- [ ] Återanvänd `loadLayoutModuleTeasers` och
  `StorefrontModuleSections`; duplicera inte en preview-specifik loader.
- [ ] Testa `live`, `paused`, `draft` och `off` för varje relevant modul.
- [ ] Testa att `paused` kan visa stängd information men inte tillåter ny
  affärsåtgärd.

## Task 3 — fasta slots och säker fallback

- [ ] Skriv test för en mall som har specialvy och en mall som saknar specialvy.
- [ ] Behåll mallens fasta sektioner och placering; lägg inte till generell
  drag-and-drop-positionering.
- [ ] Rendera befintlig specialvy när den finns.
- [ ] Rendera `StorefrontModuleSections` som generisk modulvy när specialvy
  saknas och modulens state tillåter publik visning.
- [ ] Rendera ingen trasig länk och kasta inget fel när både specialvy och
  giltig fallback saknas.

## Task 4 — förena CTA och navigation

- [ ] Skriv test för alla primära CTA-routes som finns i katalogen.
- [ ] En CTA får endast visas när dess modulroute är nåbar.
- [ ] Preview och publik storefront ska ge samma href och samma synlighet.
- [ ] `booking` ska fortsätta använda befintlig paus-/readinessgating.
- [ ] `shop` ska fortsätta använda befintlig commerce/readinessgating.

## Task 5 — kompatibilitetskontroll vid mallbyte

- [ ] Implementera en ren jämförelse mellan aktiv mall, vald mall och tenantens
  befintliga content slots. Den får inte skriva data.
- [ ] Kontrollera att saknade slots blir explicit fallback/varning och inte
  tyst dataförlust.
- [ ] Testa `Behåll nuvarande innehåll` och `Använd mallens innehåll` separat.
- [ ] Testa att bokningar, kunder, produkter, artiklar, presentkort,
  lojalitetsdata och media-id:n inte ändras av mallbytet.
- [ ] Testa att preview inte publicerar eller skriver tenantdata.

## Task 6 — verifiering och låsning

- [ ] Kör Goal 89:s fokuserade Vitest- och acceptanstester.
- [ ] Kör full webbtest, typecheck, lint och build från `5-Kod/`.
- [ ] Kör relevant read-only browseracceptans för minst en tenant med aktiv
  booking och en tenant med pausad/inaktiv modul.
- [ ] Uppdatera testlistan med faktiska resultat och datum.
- [ ] Uppdatera `2-Byggplan/ROADMAP.md` och `HANDOFF.md` först när allt är grönt.
- [ ] Flytta goal-underlaget till rätt `klart/02-ytor/storefront/` först efter
  verkligt lokalt bevis.
