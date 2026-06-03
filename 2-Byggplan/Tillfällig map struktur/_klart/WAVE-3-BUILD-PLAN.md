# WAVE 3 BUILD PLAN — handoff → stack (operativ partition)

Foundation D1 KLAR (2 världar + 5 tema-presets + settings.theme + data-world/data-theme på storefront-roots; commit fcc6d68). Detta = resten.

## ARKITEKTUR-BESLUT (gäller alla agenter)
A/B/C-systemet (`settings.layout.nav_variant` → `pickNav/pickHero/pickTemplate`, `NavA/B/C`, `Hero1/2/3`, `[data-template]`-CSS) är **ERSATT** av 5-tema-systemet (`settings.theme`). Pensionera/avveckla A/B/C. Home `(public)/page.tsx` blir parametrisk på `settings.theme`.

## 5 LAYOUTER = GENUINT OLIKA (bygg 5 layout-komponenter)
`components/storefront/layouts/{Salvia,Leander,Zigge,Linnea,Edit}Layout.tsx` + `index.ts` (`STOREFRONT_LAYOUTS: Record<StorefrontTheme, Component>`). `(public)/page.tsx` = `const L = STOREFRONT_LAYOUTS[theme]`.
| Tema | Nav | Hero | Tjänster | Team/Gallery | Knapp |
|---|---|---|---|---|---|
| Salvia (bas) | full sticky+UtilityBar | full-bleed carousel, copy bottom-left | numrerade rader 01–05 | **Team 3-up + Gallery masonry + karta** ✅ | pill |
| Leander | center 3-col wordmark | carousel centrerad | centrerad 2-col prick-prislista | ❌ | pill |
| Zigge | split | split-screen färgpanel+foto, VERSALER | horisontella band | ❌ | fyrkant r2, versal |
| Linnea | left | side-by-side text+rundad bild+blob | 3-col service-cards m. sax-ikon | ❌ | pill |
| Edit | left | asymmetrisk stor bild+överlappande textkort | numrerad 2-col grid | ❌ | fyrkant r2 |
Endast Salvia har Team+Gallery+kart-LocationCTA. Övriga 4 = MiniFooter.

## STORAGE (⭐ ägar-bilder) — utöka `tenant_settings.branding` jsonb (samma seam som logo_url)
`hero_images:string[]`, `gallery_images:string[]`, `about_image:string`, `closing_image:string`, `team:{name,role,img}[]`, `stats:[string,string][]`. Ingen ny tabell. R2-upload finns: `lib/r2/upload.ts uploadImage(file,keyPrefix)` (bucket corevo-media; sätt R2_PUBLIC_BASE_URL). Per-tema default-fallback i `components/storefront/images.ts` när nyckel tom. Utöka `@corevo/ui TenantBranding` + `lib/tenant-data.ts parseSettings`.

## KOLLISIONSBOMBER (en ägare var)
`app/globals.css` (.wizard-*/.confirm-* + .portal-* + .btn-*/.auth-*), `packages/ui/tokens.css`, `lib/tenant-data.ts parseSettings` + `@corevo/ui TenantBranding`, `storefront.module.css`, `booking.module.css`, `brand.module.css`+`nav-shell.module.css`, `admin/personal/platform.module.css`.

## FASER
**FAS 0 — SOLO FÖRST** (enabler; en agent; rör delade filer så downstream blir disjunkt):
- Lägg `[data-world=backoffice]` `--c-*` block + `.h1/.h2/.eyebrow/.body` typroller i tokens.css (porta från handoff colors_and_type.css).
- Dekomponera globals.css: flytta `.wizard-*`/`.confirm-*` → booking.module.css (eller booking-scope), `.portal-*` → back-office; behåll bara äkta globala `.btn-*`/`.auth-*`.
- Utöka `TenantBranding`(@corevo/ui) + `parseSettings` med media/team/stats-nycklar.
- Pensionera A/B/C: `brand/variants.ts` → tema-only (ta bort pickNav/pickTemplate), markera NavA/B/C + Hero1/2/3 + [data-template]-CSS för borttagning.
- VERIFIERA tsc. (Visuell verifiering ägs av slutdeploy.)

**FAS 1 — STOREFRONT (parallellt efter FAS 0):**
- Agent A (layouter+sektioner): `components/storefront/layouts/*` (5 nya), `sections.tsx`, `ServiceMenu.tsx`, nya service-presentations (ServiceCardGrid/ServiceBands/PriceList), Stat-komponenter, `(public)/page.tsx`, `HeroCarousel.tsx`, `Gallery.tsx`. ÄGER `storefront.module.css`.
- Agent B (chrome): `NavShell.tsx`(restyle, behåll scroll/burger/focus-trap), temad Nav, `Footer.tsx`+MiniFooter, `UtilityBar.tsx`, `(public)/layout.tsx`. ÄGER `brand.module.css`+`nav-shell.module.css`. Pensionera NavA/B/C.

**FAS 2 — BOKNING (parallellt, separata filer):**
- Agent C: `booking/BookingWizard.tsx` (V3 default reskin: top progress + bottom CTA-bar; + V4 `mode:'compact'` snabbboka en-sida chips+slot-grid), `booking.module.css`, `storefront/BookingDrawer.tsx` (mobil bottom-sheet: translateY+rundad topp+grabber, safe-area). Behåll befintlig engine (getAvailableSlots/createBooking/Stripe/#11-bekräftelse). V4 slot-grid gatas på async getAvailableSlots (disabled tills val klara).

**FAS 3 — BACK-OFFICE (parallellt, STRIKT separat från storefront; rör ALDRIG kund/konto):**
- Agent D (shell+primitives): `portal/PortalShell.tsx` (forest sidebar+topbar, gated `[data-world=backoffice]`), nya `portal/ui/*` (Card/Stat/Badge/Button/PageHead/Table), `portal/PortalSidebar.tsx` (roll-driven). PortalShell delas med kund → ALLT gated på [data-world=backoffice], kund/konto (un-worlded) orört.
- Agent E (skärmar): restyle `(admin)/* (platform)/* (personal)/*` på primitives. ÄGER `admin/personal/platform.module.css` (en var).

**FAS 4 — BILDUPPLADDNING (sist, efter FAS 0 + FAS 1 read-path):**
- Agent F: `lib/admin/actions.ts` (media-actions saveStorefrontMedia → uploadImage → branding jsonb), `BrandingForm.tsx`/ny `StorefrontMediaForm.tsx`, `admin/varumarke/page.tsx`, `images.ts` fallback-resolver, live-preview i storefront-world. Konsumerar branding-nycklar från FAS 0.

## Sekvens
FAS 0 solo → FAS 1+2+3 parallellt (disjunkt värld + module-CSS) → FAS 4 sist. Storefront-värld (1,2,4) och back-office (3) delar aldrig CSS-modul/komponent-dir efter FAS 0.

## Handoff-källa (agenter läser pixel-perfekt)
`2-Byggplan/Corevo Booking Design System-handoff/corevo-booking-design-system/project/ui_kits/` : `storefront/{Home,App,Chrome,Booking,BookingVariants,Account,data}`, `storefront/layouts/*`, `booking-variants/{frames,variants,desktop,core}`, `back-office/*`, `icons.jsx`; `project/colors_and_type.css` (--c-* block).

## Status: FAS 0 ⬜ igång · 1–4 ⬜
