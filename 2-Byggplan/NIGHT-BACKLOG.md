# NIGHT BACKLOG — autonom nattkörning (master-tracker)

Durabel plan så progress överlever context-compaction. Källa: `AUTOPILOT-natt.md`. Uppdatera status-kolumnen löpande.

Guardrails: POS orörd (bara booking/demo/tenant-host) · tenant-isolering + roll-RLS aldrig kringgå · build-once · ASCII-byggväg (ö-bug) → robocopy till C:\tmp\kod · en agent per revir · commit durabelt · push till main FÖRST när ALLT klart.

## WAVE 1 — slutför FAS 3
| # | Uppgift | Status |
|---|---|---|
| 1.0 | 13 kod-fixar (workflow) + commit `0f57670` | ✅ klart (tsc+lint rena) |
| 1.A | Post-review: #12 accent-fg kontrast-guard + uppdatera frusna kommentarer (storefront.module.css:7, BookCta.tsx) ; BrandingForm-preview matcha live (eyebrow/pris=primary, accent på CTA-chip) ; #17 död .hero3* i brand.module.css ; stale kommentar kontakt/page.tsx | 🔜 igång |
| 1.B | Wire G: review-nudge + rebook-mejl (klart c2f66d9) + **prefs** (per-typ e-post-toggle) + **Google review-URL-fält i admin** | 🔜 scout |

## WAVE 2 — verkliga scenarier (måste funka, styrs via inställning ej kod)
| # | Uppgift | Status |
|---|---|---|
| 2.1 | Bokningskedja: kund→specifik frisör→hamnar i frisörens schema→admin ser. Verifiera live | ⬜ |
| 2.2 | Flera frisörer/ställen → "var vill du boka?"-steg först (Voady-likt); ett ställe → hoppa | ⬜ |
| 2.3 | Lediga tider speglar verkligheten: frånvaro (time_off) + stängda öppettider blockerar slots | ⬜ |
| 2.4 | Gäst hanterar bokning utan konto: avboka/omboka via länk i mejl, "hitta min bokning" via tel+kod | ⬜ |
| 2.5 | Avboknings-fönster (per-salong-inställning) + avboka-knapp/länk i bekräftelse | ⬜ |
| 2.6 | Cookie-banner på storefront (EU-consent) | ⬜ |
| 2.7 | SMS-notiser som AVSTÄNGD toggle (krok + per-salong-toggle, ingen leverantör än) | ⬜ |
| 2.8 | Toggles per salong utan kod: kund-konton + poäng/lojalitet (build-once/toggle) | ⬜ |
| 2.9 | Onboarding ny salong i platform-admin (steg för steg); domän koppla/gated | ⬜ |
| 2.10 | Login stabil alla roller + kund (minimal kund-login). Verifiera efter ändringar | ⬜ |

## WAVE 3 — design-implementering (agent-flotta-workflow, pixel-perfekt från handoff)
Källa: `2-Byggplan/Corevo Booking Design System-handoff/.../project/` (README+SKILL+colors_and_type.css+preview+screenshots) + `kopia-till-design/` (DESIGN-BRIEF, design-referens, TILLÄGG-01). Handoff = facit utseende; FAS 1 = grunden den kläs på (ersätt platta versionen, inte konkurrerande).
| # | Uppgift | Status |
|---|---|---|
| 3.1 | Läs handoff README/SKILL/brief/TILLÄGG + nyckel-screenshots → plan | ⬜ |
| 3.2 | 5 storefront-stilar (Atelier/Brass/Lera/Kontur/Blom) som tenant tema-presets | ⬜ |
| 3.3 | Bokning Variant 3 (default, steg) + Variant 4 (snabbboka kompakt), inbäddat in-page | ⬜ |
| 3.4 | ⭐ Ägaren byter storefront-bilder (hero/galleri/team) per tenant R2 + live-preview | ⬜ |
| 3.5 | Foto-strategi: starka default-bilder per stil + uppladdning i onboarding | ⬜ |
| 3.6 | Back-office i Corevo-look enligt handoff | ⬜ |
| 3.7 | Två CSS-världar separerade; guld tenant-överstyrbart storefront / fryst back-office | ⬜ |

## WAVE 4 — finalisering
| # | Uppgift | Status |
|---|---|---|
| 4.1 | Build + deploy + omfattande live-verifiering (booking.corevo.se + demo.corevo.se) | ⬜ |
| 4.2 | Uppdatera HANDOFF + "testa detta"-lista för Zivar | ⬜ |
| 4.3 | Commit + **push till main** | ⬜ |

## Blockerare som väntar på Zivar
- (löst) SUPABASE_SERVICE_ROLE_KEY satt av Zivar.
- Skarp custom-domän/DNS för nya salonger = gated (rör aldrig POS utan OK).
- Leverantörsval SMS = senare (kroken byggs nu).

## Städning
- Root-skräp: många `*.jpeg/*.png` referens-screenshots ligger i repo-roten (voady/tofifi/studio/fas*) — bryter no-root-dump. Flytta till `3-Bakgrund-Research/referens-screenshots/` innan slutcommit (ej radera — Zivars referens).

## PROGRESS LOG (2026-06-02 natt)
- ✅ Säkerhet: migr 0009+0010 applicerade+AFTER-verifierade (6/6). E2E Test Kund avbokad.
- ✅ WAVE 1.0 13 kod-fixar → commit `0f57670`.
- ✅ WAVE 1.A post-review (accent-fg guard, kommentarer, BrandingForm-preview, #17) → `edf9ceb`.
- ✅ WAVE 1.B Wire G + WAVE A (SMS-krok+toggle, gäst-avboka token+/avboka, admin notif-UI+Google-URL) → `42f6d16`. tsc+lint rena. (Workflow kraschade på schema-output men filer landade; jag fixade 2 tsc-fel + pre-fill-bug manuellt.)
- 🔄 Deploy WAVE A → bakgrund (bg b7xtzfxcj), sen live-verifiera.
- WAVE 2 status: 2.4 gäst-avboka ✅(avboka via länk; rebook+telefon-lookup ej byggt), 2.5 avboknings-fönster+länk ✅, 2.7 SMS-toggle ✅(stub). 2.1/2.3/2.9/2.10 = verifiera live efter deploy. 2.2 location-steg + 2.6 cookie-banner → DESIGN-fasen (storefront-UI). 2.8 lojalitet = defer (not: kund-konto-toggle finns redan).
- NÄST: deploy klar → live-verify → uppdatera HANDOFF → WAVE 3 DESIGN (se WAVE-3-DESIGN-PLAN.md).

## WAVE 3 DESIGN — progress
- ✅ D1 foundation (2 världar-tokens + 5 tema-presets + settings.theme + CSP-fonts) → `fcc6d68`.
- ✅ FAS 0 enabler (backoffice-token-block, globals.css-dekomp → booking-global.css+portal-global.css, branding media-nycklar) → `f65db92`.
- ✅ FAS 1-3 design-build (3 agenter: 5 storefront-tema-layouter+chrome, bokning V3/V4+mobil-sheet, back-office Corevo-reskin) → `f861d47`. tsc+eslint rena. DEPLOYAD live `5a3894de`, alla rutter 200.
- 🔄 FAS 4 ägar-bilduppladdning (R2) → bakgrund (agent a4c04bb6).
- ⚠️ DEPLOY-LÄRDOM: robocopy MÅSTE köras med **/PURGE** (annars ligger raderade filer kvar i C:\tmp\kod och bryter bygget — hände med NavA/B/C). Kommando: `robocopy <src> C:\tmp\kod /E /PURGE /XD node_modules .next .open-next .git /XF .env.local`.
- KVAR: FAS 4 klar → final-deploy (/PURGE) → full visuell verify (5 teman via settings.theme + bokning V3/V4 + back-office + 3-roll-login + boknings-kedja) → HANDOFF + testlista → push main. Cookie-banner (2.6) + location-steg (2.2) ej byggt än (bygg om tid, annars flagga).

## WAVE 3 design — förfinade insikter (från handoff READMEs)
- 5 teman = DISTINKTA LAYOUTER (TILLÄGG-01-svar): `ui_kits/storefront/layouts/{Leander,Zigge,Linnea,Edit}.jsx` + salvia=bas (Home.jsx). Ej bara token-swap. Display-namn: Studio Salvia/Maison Leander/Zigge/Salong Linnea/Edit.
- Storefront-komponenter (handoff): Chrome (UtilityBar/Nav sticky transp→blur/Footer/Wordmark), Home (Hero foto-carousel, Services numrerade 01–05, About m. italic + stat-trio, Team, Gallery, LocationCTA m. OSM-karta), Booking (inbäddad drawer 5 steg), Account (login/register/Mina tider modal).
- Bokningsvarianter: V3 steg-för-steg (DEFAULT, en sak/skärm, bottom-CTA tum) + V4 kompakt (snabbboka, alla val synliga, chips+slot-grid). Mekanism = drawer (V2) inbäddad. `frames.jsx`+`variants.jsx`+`desktop.jsx`.
- Back-office (World 2): Shell = Sidebar(mörk forest)+Topbar + primitives Badge/Button/Card/Stat/PageHead/Table. Skärmar SuperAdmin/SalonAdmin/Branding(live storefront-preview)/Staff. Onboarda = 4-stegs wizard (namn&subdomän→temamall(5)→branding→ägare).
