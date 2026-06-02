# WAVE 3 — DESIGN-IMPLEMENTERING (durabel plan)

Pixel-perfekt implementation av Claude Design-handoffen i Next.js-stacken. Handoff = facit utseende; FAS 1 = grund som kläs på (ersätt platta versionen, ej konkurrerande). Agent-flotta-workflow, disjunkta filägor.

## Källa (handoff)
`2-Byggplan/Corevo Booking Design System-handoff/corevo-booking-design-system/project/`
- `colors_and_type.css` — TOKENS, scoped `[data-world="storefront"|"backoffice"]` + `[data-theme]`. (LÄST — porta denna.)
- `ui_kits/storefront/layouts/{Leander,Zigge,Linnea,Edit}.jsx` (+ salvia = bas i Home.jsx) — 5 DISTINKTA layouter.
- `ui_kits/storefront/{Home,Booking,BookingVariants,Account,Chrome,Demo,App}.jsx` + `data.js`
- `ui_kits/booking-variants/{variants,desktop,frames}.jsx` + `core.js` — bokningsvarianter.
- `ui_kits/back-office/{App,Shell,SalonAdmin,Staff,Branding,SuperAdmin}.jsx` + `data.js` — Corevo back-office-look.
- `ui_kits/icons.jsx` — Lucide-deriverad ikon-set.
- `preview/*.html`, `screenshots/*.png` — referens (agenter läser .jsx/.css direkt, ej screenshots enl. README).
`kopia-till-design/`: DESIGN-BRIEF.md, design-referens-storefront.md, TILLÄGG-01 (5 stilar + bokningsvarianter).

## 5 STOREFRONT-TEMAN (exakt från handoff colors_and_type.css)
Bygg som riktiga tenant-presets. `data-theme` på storefront-root. Per-tenant fine-tune (injectTenantTokens: color_primary/accent/font/logo) läggs OVANPÅ valt tema.
| tema-id | känsla | primary | bg | fg | display-font | body-font | radius |
|---|---|---|---|---|---|---|---|
| salvia | salvia/airy/minimal | #5E7361 | #F6F4EE | #232520 | Cormorant Garamond | Jost | 10px |
| leander | lavendel/romantisk editorial (elegant/lyx) | #7E6E92 | #FBFAF8 | #2A2630 | Playfair Display | Inter | 14px |
| zigge | mörk barber, burnt amber på svart | #C8743C | #14120E | #F2ECE2 | Bebas Neue | Archivo | 4px |
| linnea | varm skandinavisk, terrakotta/lera på sand | #B0693F | #F4EDE1 | #2E2820 | DM Serif Display | Inter | 12px |
| edit | charcoal på ivory, minimal editorial | #3A3733 | #F8F6F1 | #232220 | Cormorant Garamond | Inter | 2px |
Type-roller: `.sf-eyebrow/.sf-hero/.sf-h1/.sf-h2/.sf-lede/.sf-body/.sf-italic` (zigge har egen Bebas-rytm). Globala primitives: spacing/radii/motion i :root.
**NAMNGIVNING:** autopilot säger Atelier/Brass/Lera/Kontur/Blom men handoff har salvia/leander/zigge/linnea/edit (ingen lekfull "Blom"). Bygg de FAKTISKT designade 5; svensk display-namn; flagga ev. rename till Zivar (trivialt byte).

## Two worlds (hård regel)
Storefront-CSS BARA under `[data-world="storefront"]`; back-office BARA under `[data-world="backoffice"]`. Aldrig blanda. Guld tenant-överstyrbart storefront (#12 klart), fryst back-office. Back-office = forest #1F4636 + gold #F5A623 på cream, Playfair+Inter, mörk sidebar.

## Bokning
Variant 3 (steg-för-steg wizard) = DEFAULT + Variant 4 (kompakt en-sida snabbboka) = snabbboka. Båda INBÄDDADE in-page (drawer, #11 in-drawer-bekräftelse klar). Mobil-först (99% mobil): stora tidschips, viktiga knappar i nederkant (tum), minimal scroll. Bygg från `ui_kits/booking-variants/` + nuvarande BookingWizard som bas.

## ⭐ Ägaren byter sina bilder (design missade — MÅSTE)
Salong-admin → Varumärke: ladda upp/byta storefront-bilder (hero, galleri, team-foton), ej bara logga/färg/text. Sparas per tenant i R2 (bucket `corevo-media` finns; sätt R2_PUBLIC_BASE_URL). Live-preview. Per-tema starka default-bilder så tom salong ej blir bar (Studio Nord-problemet). Onboarding promptar uppladdning.

## Integration-approach
1. **TOKENS (foundation, solo först):** porta colors_and_type.css → packages/ui (storefront-themes.css + backoffice.css), scoped [data-world]/[data-theme]. Behåll injectTenantTokens för per-tenant override ovanpå tema.
2. **THEME-SETTING:** tenant-setting `settings.theme` ∈ {salvia,leander,zigge,linnea,edit} (default leander el. salvia). Väljs i onboarding (platform create) + admin Branding. Appliceras data-world/data-theme på storefront-root + alla (public)/boka-layouts.
3. **STOREFRONT-LAYOUTS:** 5 tema-layouter (recreate pixel-perfekt från layouts/*.jsx) + delade sektioner där handoff delar. Ersätt nuvarande nav A/B + hero 1/2-variantsystem.
4. **BOOKING-VARIANTS:** Variant 3 default + 4 snabbboka, inbäddat.
5. **IMG-UPLOAD:** R2-uppladdning hero/galleri/team + live-preview + storefront render m. per-tema defaults.
6. **BACK-OFFICE:** reskin admin/personal/platform → Corevo-look (data-world=backoffice) från ui_kits/back-office/*.

## Partition (disjunkt filägo — kör efter TOKENS solo)
- TOKENS: packages/ui/* (tokens) + app/(public)/layout + boka/layout data-world/data-theme application. SOLO FÖRST.
- THEME-PICKER: settings.theme write (admin Branding + platform create + saveBranding/createTenant) + read (tenant-data).
- STOREFRONT-LAYOUTS: components/storefront/* + layouts (5). (ev. dela per tema om för stort.)
- BOOKING-VARIANTS: components/booking/* + storefront BookingDrawer/Provider.
- IMG-UPLOAD: admin Branding image-upload + lib R2 + storefront image render + defaults.
- BACKOFFICE: components/{admin,personal,platform}/* + their module.css → backoffice tokens.
Kollisionsrisk: storefront.module.css (layouts + booking) — håll booking-styles i booking.module.css; layouts äger storefront.module.css. data-world application (TOKENS) i layouts — gör FÖRST, sen rör ingen annan de root-layouterna utom att läsa.

## Status
⬜ Allt. Påbörjas efter WAVE A + checkpoint-deploy. Uppdatera NIGHT-BACKLOG WAVE 3-raderna.
