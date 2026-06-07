# goal-17 — Design-trohet "make-it-match" (✅ KLAR, render-verifierad, live)

Slutförd 2026-06-05. Standard = root-design-paketet (`2-Byggplan/acceptans/` + v3-handoff) = LAG, exakt kopia, render-verifierad (aldrig ögonmått). Den ursprungliga briefen + GAP-INVENTORY rensades under arbetet; detta är slut-loggen.

## Vad som byggdes (alla faser render-verifierade 0 FAIL)
- **FAS 1 — back-office design-trohet** (commit `656781d` + retrofit-rundor `7e4e234`/`194f1f4`/`e59af85`/`41b7c8c`): 7 sidor retrofittade till v3-komposition (Kunder/Inställningar/Platform/Personal/Scheman/Bokningar/Tjänster) + Dashboard/Varumärke flaggskepp. Delade primitiver (Callout/Drawer/Toast/ViewSwitcher, `[data-world=backoffice]`-scopat). Render-domare 0 FAIL.
- **Plattform super-admin-yta** (commit `40526bc`): 6 vyer + Översikt-sparkline, render-verifierat.
- **Salonger** (commits `7726a36`/`6da0e63`): kort-grid + per-salong soft-delete + status härlett ur setup-completeness. Live worker `657849d9` (se [[corevo-platform-salonger-surface]]).
- **Onboarding-wizard `/salonger/ny`** (commit `6beb978`): 5-stegs design-wizard, skriver `settings.theme` + accent-only branding (ingen tema-maskering). Render-verifierat (se [[corevo-onboarding-wizard]]).
- **FAS 2 — `/konto` kundportal** (commit `a325b5c` + **`eedd14f`**): §4.8 storefront-world (IdentityHero/StylistCard/AccountLoyalty/UsualCard/AccountBookings/AccountHistory/AccountPrivacy/FavoritesList). **Render-verifierad 2026-06-05** inloggad som seedad kund på `freshcut.localhost` (salvia) — BÅDE tom OCH ifylld state mot §4.8: booking-kort (Kommande + Omboka/Avboka), BRONS/50p lojalitet, UsualCard, historik, Integritet = ÄRLIGA statiska indikatorer (namn-switch = `<span>`, consent-toggle `aria-disabled`, INGA döda save-kontroller), 0 console-fel.
  - **`eedd14f` (slut-fix):** ersatte den generiska PortalShell-headern (som läckte e-post + rå roll-enum "· kund") med salongens **storefront-header** (wordmark→hem + "Mina sidor"-eyebrow + kund-initial-avatar + Logga ut). PortalShell kund-gren sätter nu `data-world="storefront"` + `data-theme` + `injectTenantTokens` på SAMMA root-element → headern temas med kroppen. Back-office-grenen byte-oförändrad (oberoende granskad, 0 regression).
- **FAS 3 — storefront**: 5 teman + micro-interactions redan live (`storefront.module.css`). Kvar = riktigt innehåll (logo/foton = Zivar).

## Gate + deploy
- typecheck 0 · lint 0 · **vitest 192/192**. opennext-build PASS (ASCII-väg), grep-guard ren (ingen `localhost:3000` i byggd middleware).
- **Live worker `c74a3390-53a8-4ccb-8d9f-92b884c00425`** (deployad 2026-06-05). **Rollback `4eb0aa02-d47a-48c7-96dd-f3131fe5c541`** (`wrangler rollback 4eb0aa02… --config 5-Kod/apps/web/wrangler.jsonc`). POS `corevo.se`+`admin.corevo.se` → 200; `freshcut.corevo.se` → 200 + tenant-kind-header; `/konto` 307→login (anon). Pushad `eedd14f` → origin/main.
- Skärmdumpar: `4-Dokument-Underlag/skarmdumpar-bygg/goal17-konto-verify/`.

## Känt / kvar (ej blockerande)
- **Test-data på prod** seedad för /konto-render-verify (1 completed + 1 cancelled bokning, testkund, +50 lojalitet, append-only-loggar) → behöver Zivar-auktoriserad purge (append-only-design + auto-mode blockerar). Se [[corevo-konto-verify-residual-data]].
- FAS 3 storefront `opacity:0` reveal-on-scroll vs micro-interactions-canon = Zivars medvetna val (ej rört).
