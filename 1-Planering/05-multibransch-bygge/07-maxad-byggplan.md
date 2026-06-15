# Maxad byggplan — multi-bransch hela vägen till live

> Skapad 2026-06-15. Driver bygget från nuvarande grund → komplett, deployad multi-bransch-plattform. Körs wave för wave, maximalt parallellt. Ingång: `00-plan-index.md`.

## Status nu
- **DB-grund LIVE på prod** (verticals, modules, tenant_modules, templates, content_slots, media_assets) ✓
- **App-ryggrad byggd + grön** (typecheck 0, 330 tester): wizard bransch-först, onboarding skriver tenant_modules, storefront gatear på modul-state, FreshCut-säker. **Ej deployad.**

## Deploy-väg (välja)
- ö:et i `firsör-sas` kraschar opennext lokalt → bygg via `C:\tmp\kod` + wrangler (Windows).
- **(a) manuellt:** Zivar kör ett deploy-kommando per release.
- **(b) auto-deploy (rek):** Cloudflare Workers Builds / git-push → bygg → live (hands-off; krävs för att schemat ska deploya självt). Verifiera att det ryms i gratis/befintlig plan (inga nya betaltjänster utan OK).
- Efter varje deploy: **live-verifiera** (FreshCut oförändrad + nya flödet funkar).

## Wave A — nu, parallellt (säkert, ingen paid, ingen deploy-risk)
1. **Super-admin Moduler-kort** på `/salonger/[id]` — toggla off/draft/live/paused per modul (off→draft = super-admin via state-vakt).
2. **Mall-import (token+sektion)** — kör på FRIA (MIT) + frisör-mallar först → fyll `templates`/`template_slots` (draft tills godkänd).
3. **Fler branscher + mall-picker** — seed barbershop/nagelstudio/restaurang/generell; wizardens Temamall läser `templates` filtrerat på bransch.

## Wave B — visuell hub + assets
4. **Super-admin preview-redigerare** — live-preview av kundsida + klick-slot-redigering (clone-app studerar GrapesJS/Puck för UX). v1 slot → mål full sidbyggare.
5. **R2 + assets + bild-swap** — uppladdning → R2 → media_assets/content_slots → swap på skarp sida. (R2 paid-check FÖRST: bekräfta gratis-tier, inga överraskningskostnader.)

## Wave C — moduler à la carte + utrullning
6. **Webshop-modul** (varianter: posta / hämta inom X dgr / beställ-hem) + offert + blogg, en i taget.
7. **Licens-grindad mall-utrullning** — efter Zivars licens-beslut (htmlcodex-krediter): rulla ut godkända mallar branschvis.
8. **Terminologi per bransch** + polish + QA.

## Parallellisering
Inom en wave: oberoende spår = egna subagenter samtidigt, disjunkta filset. Tätt kopplade flöden (wizard↔actions↔storefront) = EN byggare för att undvika merge-krockar. Verifiera varje (typecheck + tester + render efter deploy).

## Schema (autonom drift)
Om allt inte ryms i en session: schemalägg en körning som tar nästa obyggda spår i denna plan → bygg med subagenter → testa → committa → uppdatera LOG → prep/utför deploy (om auto-deploy finns) → flagga paid/manuella steg. Stäng av schemat när planen är klar.

## Hårda regler
POS (`corevo.se`) rörs aldrig · build-once-never-delete · `private.tenant_id()` · `staff`/`staff_id` · Supabase `clylvowtowbtotrahuad` · inga betaltjänster utan OK · verifiera före "klart".
