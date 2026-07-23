# Goal 79 — FreshCut Fast Customer Website Implementation Plan

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

- [ ] Skriv ett render-test med sju verkliga serviceobjekt och en
  `BookingProvider` med `reachable={false}`, `websiteOnly` och extern HTTPS-länk.
- [ ] Kräv källrubrikerna `Klippt. Format. Klart.`, `Välj ditt upplägg.`,
  `Detaljerna gör skillnaden.`, `Din lokala barberare.` och
  `Vi ses i stolen.`.
- [ ] Kräv att tjänsternas props-baserade namn, `duration_min` och
  `price_cents` finns i HTML och att externa bokningsytor har säker ny flik.
- [ ] Kör:
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
  `5-Kod/apps/web/public/images/freshcut/freshcut-hero.png`,
  `freshcut-2.png`, `freshcut-3.png`, `freshcut-4.png`,
  `freshcut-barber.png`

**Interfaces:**

- Consumes: `ThemeNavProps`, `ThemeFooterProps`, `BookCta`, `Bookable`,
  `content`, `services`, `location`.
- Produces: `FreshCutNav`, `FreshCutFooter` och ny `FreshCutLayout`.

- [ ] Exportera de fem godkända källbilderna till lokala, återgivningsstabila
  assets och uppdatera FreshCut-defaults till deras paths.
- [ ] Implementera kundägd toppremsa/nav med källans ordmärke och ankarlänkar;
  rendera framtida modulvägar och konto/korg endast när plattformen skickar dem.
- [ ] Implementera alla hemsidessektioner med semantiska landmarks och exakt
  källcopy som defaults.
- [ ] Rendera prislistan från `services`; använd beskrivningen om den finns och
  en namnbaserad FreshCut-default annars.
- [ ] Använd `BookCta` för knappar och `Bookable` för kort/rader så extern och
  intern bokning fortsätter följa Goal 78.
- [ ] Implementera källans desktop- och mobil-CSS inklusive fokus,
  hover och reduced motion.
- [ ] Registrera FreshCut-chrome i `themeChrome('freshcut')`.
- [ ] Kör kontrakttestet och bekräfta GREEN.

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

- [ ] Uppdatera `freshcut`-defaults till källsidans hero, service-, resultat-,
  studio- och kontaktcopy med befintliga copyfält.
- [ ] Behåll `freshcut` utanför generella onboardingval.
- [ ] Justera endast FreshCuts temavariabler till källans exakta palett och raka
  geometri.
- [ ] Lägg kontraktstest som bevisar att en tenant-override fortfarande vinner.
- [ ] Kör riktade theme-/copytester och bekräfta GREEN.

### Task 4: Lokal previewdata och browseracceptans

**Files:**

- Create:
  `6-Testing/goal-79-freshcut-fast-kundwebb-testlista.md`
- Update:
  `HANDOFF.md`

**Interfaces:**

- Consumes: Supabase-previewbranchen `localhost-acceptance`.
- Produces: reproducerbart lokalt acceptansbevis, utan produktion.

- [ ] Sätt endast syntetisk previewtenant till `theme=freshcut`,
  `booking=off`, extern HTTPS-länk, kontakt/social och FreshCut-adress.
- [ ] Kontrollera desktop vid 1280px mot källans sektioner, typografi,
  färger och bildutsnitt.
- [ ] Kontrollera mobil vid 390px, meny, fast boknings-CTA och horisontell
  overflow.
- [ ] Bekräfta att alla bokningsytor går till samma externa HTTPS-länk med
  `target="_blank"` och `rel="noopener noreferrer"`.
- [ ] Kör riktade tester, `pnpm typecheck` och riktad ESLint.
- [ ] Låt Fable göra en oberoende P0/P1-granskning av staged diff.
- [ ] Flytta goalfilen till
  `2-Byggplan/klart/02-ytor/storefront/` först när allt ovan är grönt.
- [ ] Commit och push utan de parkerade Goal 74-filerna.

