# Goal 79 — FreshCut Fast Customer Website Implementation Plan

**Status:** VERIFIERAT KLAR lokalt 2026-07-23. Inte deployad.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersätt den gamla kundlåsta FreshCut-mallen med den godkända nya
FreshCut-sidan utan att tappa verklig tenantdata, adminredigering eller säkert
externt bokningsflöde.

**Architecture:** `freshcut` behåller sin befintliga temanyckel och förblir dold
från nya kunder. En fokuserad layout och ett kundägt chrome renderar källans
struktur; `BookCta`/`Bookable`, `services`, `location`, `settings.contact` och
`settings.social` förblir de enda funktions- och datakällorna.

**Tech Stack:** Next.js App Router, React server/client components, CSS Modules,
Vitest, Supabase-preview och lokal browseracceptans.

## Global Constraints

- Källsidan `https://freshcut-salong.honeybo.chatgpt.site/` är visuell kanon.
- `freshcut` får inte visas som generell mall för nya kunder.
- Ingen produktionsdeploy eller produktionsdataskrivning ingår.
- Extern bokning aktiveras bara av explicit `booking=off` enligt Goal 78.
- Kunddata och ägarens sparade redigeringar vinner över mallens defaults.
- Nya filer placeras i rätt projektmapp, aldrig i repo-roten.

---

### Task 1: Lås FreshCut-kontraktet med röda tester

**Files:**

- Create:
  `5-Kod/apps/web/components/storefront/layouts/freshcut-v2.contract.test.tsx`
- Modify:
  `5-Kod/apps/web/components/storefront/layouts/FreshCutLayout.tsx`

**Interfaces:**

- Consumes: `StorefrontLayoutProps`, `BookingProvider`, `BookCta`, `Bookable`.
- Produces: kontrakt för källcopy, verkliga tjänster och extern bokning.

- [x] Skriv ett render-test med sju verkliga serviceobjekt och en
  `BookingProvider` med `reachable={false}`, `websiteOnly` och extern HTTPS-länk.
- [x] Kräv källrubrikerna `Klippt. Format. Klart.`, `Välj ditt upplägg.`,
  `Detaljerna gör skillnaden.`, `Din lokala barberare.` och
  `Vi ses i stolen.`.
- [x] Kräv att tjänsternas props-baserade namn, `duration_min` och
  `price_cents` finns i HTML och att externa bokningsytor har säker ny flik.
- [x] Kör:
  `pnpm exec vitest run components/storefront/layouts/freshcut-v2.contract.test.tsx`
  och bekräfta RED mot den gamla layouten.

### Task 2: Bygg layout, chrome och lokala assets

**Files:**

- Modify:
  `5-Kod/apps/web/components/storefront/layouts/FreshCutLayout.tsx`
- Replace:
  `5-Kod/apps/web/components/storefront/layouts/freshcut.module.css`
- Create:
  `5-Kod/apps/web/components/storefront/layouts/FreshCutChrome.tsx`
- Modify:
  `5-Kod/apps/web/components/storefront/layouts/florist/layouts.tsx`
- Add binary assets:
  `5-Kod/apps/web/public/images/freshcut/freshcut-hero.webp`,
  `freshcut-2.webp`, `freshcut-3.webp`, `freshcut-4.webp`,
  `freshcut-barber.webp`

**Interfaces:**

- Consumes: `ThemeNavProps`, `ThemeFooterProps`, `BookCta`, `Bookable`,
  `content`, `services`, `location`.
- Produces: `FreshCutNav`, `FreshCutFooter` och ny `FreshCutLayout`.

- [x] Exportera de fem godkända källbilderna till lokala, återgivningsstabila
  assets och uppdatera FreshCut-defaults till deras paths.
- [x] Implementera kundägd toppremsa/nav med källans ordmärke och ankarlänkar;
  rendera framtida modulvägar och konto/korg endast när plattformen skickar dem.
- [x] Implementera alla hemsidessektioner med semantiska landmarks och exakt
  källcopy som defaults.
- [x] Rendera prislistan från `services`; använd beskrivningen om den finns och
  en namnbaserad FreshCut-default annars.
- [x] Använd `BookCta` för knappar och `Bookable` för kort/rader så extern och
  intern bokning fortsätter följa Goal 78.
- [x] Implementera källans desktop- och mobil-CSS inklusive fokus,
  hover och reduced motion.
- [x] Registrera FreshCut-chrome i `themeChrome('freshcut')`.
- [x] Kör kontrakttestet och bekräfta GREEN.

### Task 3: Koppla redigerbar copy och kundspecifika defaults

**Files:**

- Modify:
  `5-Kod/apps/web/components/storefront/theme-content.ts`
- Modify:
  `5-Kod/apps/web/lib/platform/theme-capabilities.ts`
- Modify:
  `5-Kod/packages/ui/tokens.css`
- Test:
  `5-Kod/apps/web/lib/storefront/theme-owns-copy.test.ts`

**Interfaces:**

- Consumes: `resolveThemeContent` och befintliga `CopyOverride`-nycklar.
- Produces: FreshCut-defaults där ägarens sparade copy/media fortfarande vinner.

- [x] Uppdatera `freshcut`-defaults till källsidans hero, service-, resultat-,
  studio- och kontaktcopy med befintliga copyfält.
- [x] Behåll `freshcut` utanför generella onboardingval.
- [x] Justera endast FreshCuts temavariabler till källans exakta palett och raka
  geometri.
- [x] Lägg kontraktstest som bevisar att en tenant-override fortfarande vinner.
- [x] Kör riktade theme-/copytester och bekräfta GREEN.

### Task 4: Lokal previewdata och browseracceptans

**Files:**

- Create:
  `6-Testing/goal-79-freshcut-fast-kundwebb-testlista.md`
- Update:
  `HANDOFF.md`

**Interfaces:**

- Consumes: Supabase-previewbranchen `localhost-acceptance`.
- Produces: reproducerbart lokalt acceptansbevis, utan produktion.

- [x] Sätt endast syntetisk previewtenant till `theme=freshcut`,
  `booking=off`, extern HTTPS-länk, kontakt/social och FreshCut-adress.
- [x] Kontrollera desktop vid 1440px mot källans sektioner, typografi,
  färger och bildutsnitt.
- [x] Kontrollera mobil vid 390px, meny, fast boknings-CTA och horisontell
  overflow.
- [x] Bekräfta att alla bokningsytor går till samma externa HTTPS-länk med
  `target="_blank"` och `rel="noopener noreferrer"`.
- [x] Kör riktade tester, `pnpm typecheck` och riktad ESLint.
- [x] Låt Fable göra en oberoende P0/P1-granskning av diffen.
- [x] Flytta goalfilen till
  `2-Byggplan/klart/02-ytor/storefront/` först när allt ovan är grönt.
- [x] Commit och push utan de parkerade Goal 74-filerna.

## Verifieringsbevis

- Lokal publik host: `http://demo.127.0.0.1.nip.io:3100`
- Supabase-preview: `localhost-acceptance`
  (`cwnhpesrgolflkmyjbrm`)
- 19/19 renderade Bokadirekt-länkar säkra; 0 interna `/boka`.
- Desktop 1440 × 900 och mobil 390 × 844 browserverifierade.
- 211 riktade tester, typecheck, lint och preview-build gröna.
- Fable 5: `NO P0/P1`.
- Full testlista:
  `6-Testing/goal-79-freshcut-fast-kundwebb-testlista.md`.
