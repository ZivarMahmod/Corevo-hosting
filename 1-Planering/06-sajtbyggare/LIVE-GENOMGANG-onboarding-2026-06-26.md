# LIVE-GENOMGÅNG — onboarding + kund vs tanken (2026-06-26)
> Cowork drev Zivars inloggade browser (superbooking.corevo.se) och dokumenterade varje fel mot tanken (boxen). Konsol + nätverk lästa live. Bevis för goal-50.

## Onboarding-studio (Onboarda kund → steg-för-steg)
1. **"Välj startmall" = BRANSCH-väljaren**, inte en mall. Korten: Barbershop / Frisör / Generell / Nagelstudio / Restaurang. Stegets egen text: *"Branschen är bara en förinställning."* → namnet "startmall" blandar ihop bransch + look.
2. **"Temamall" = bransch-filtrerad lista.** Barbershop → 4 alternativ (Corevo Alotan BB / BarberX BB / Barberz / Zigge). Inte alla mallar — filtrerat på branschen.
3. **Identisk render (BEVISAT LIVE):** Alotan, BarberX, Barberz → SAMMA sida — samma rubrik "Din frisör i lugn och ro", samma layout, samma färger, bara olika foto. Bara Zigge skiljer (mörk "RENT SNITT. INGEN KRÅNGEL."). → **4 namn = 2 faktiska renders.** Spelar ingen roll vad man väljer.
4. **Dev tools:** NOLL konsol-fel vid mall-byte. Alltså INTE en krasch — det är så det är byggt (namnen kopplar inte till distinkta mallar). Nätverk: previewen laddas om vid varje val, men inga 500/fel.

## Kund (Test Barber) — 6 flikar, ALLA stabila (ingen krasch, noll konsol-fel)
- **Översikt:** onboarding-steg alla ✓; "Anpassningsnivå 2" (token-branding aktiv).
- **Data:** salongsnamn (subdomän låst), Google-recensionslänk (FTC-känsligt fält), boknings-vy (Steg-för-steg) — uttryckligen **skild från temamallen** (bra separation, den finns alltså redan på ett ställe).
- **Personal:** 1 personal "Väntar bekräftelse"; notis: invite kräver `SERVICE_ROLE_KEY` (ops-gap, kopplar till känd onboarding-mail-bug).
- **Branding:** no-code token-branding (färg/font/logo, "slår igenom utan deploy"). Känd savePlatformBranding-clobber bor här — EJ testad (vore en skrivning på din kund).
- **Integrationer:** Stripe Connect "Ej ansluten — kontot kan inte ta betalt ännu" (bekräftar betalning AV), Google-recensioner ej satt, SMS (46elks) plattformsbred, domän-config (custom hostname).
- **Drift:** modul-toggles per kund (Bildbibliotek / Blogg / Bokning = Live), pausa-salong (RLS + cache-bust).

## VS TANKEN (boxen) — gapet = goal-50
| Tanken | Verkligheten idag |
|---|---|
| EN box, alla mallar likvärdiga | bransch + mall + tema ihopblandade |
| Alla mallar valbara oavsett bransch | "temamall" bransch-filtrerad (3–4 visas) |
| Varje mall renderar DISTINKT | flera namn → samma render (4 namn = 2 renders) |
| Modul vävs in i vald mall | render-bron finns; ej bevisad i denna vy |

## Slutsats
Super-admin-ytorna är **STABILA** — noll krascher, noll konsol-fel genom hela genomgången. Problemet är alltså INTE buggar i dessa ytor. Det är fel **MODELL**: teman ≠ mallar, bransch-filter på looken, flera namn som ger samma render, salvia-special i kund-editorn. Exakt det goal-50 river och bygger om (boxen). Bekräftar goal-50:s LÅST + RIV BORT + LIVE-BEVIS-sektioner.

## Kund-admin (booking.corevo.se/admin) — DÄR "det funkar inte" verkligen sitter
- **Ingen visuell sajt-editor.** `/admin/sajtbyggare` 404:ar ("salongen inte tillgänglig"). Kund-menyn har bara "Se din sida" (visa, ej redigera) + Bildbibliotek. Ingen klicka-på-elementet-editor finns nåbar.
- **Bildbiblioteket är BLINT.** `/admin/media`: platt lista av uppladdade bilder (sneaker + 2 t-shirts) med "Ingen alt-text". INGEN koppling till VAR bilden landar på sidan. Zivar laddar upp → bilden hamnar någonstans (sneaker → om-sektion, t-shirt → hero) utan kontroll/förhandsvisning.
- **KORRIGERING (Zivar):** de udda bilderna på storefronten är Zivars EGNA test-uppladdningar, inte trasiga defaults. Problemet är avsaknaden av en **placerings-editor** som visar var bilden landar.
- **Salvia-only.** Full sajt-redigering finns bara för salvia-temat (övriga = stub).

## SLUTSATSEN — varför det "inte funkar" (kärnan, efter full live-genomgång)
Sajtbyggaren — produktens hjärta — är till stora delar en FASAD på kund-nivå:
1. **Mall-valet är fejk** — 5 teman, bransch-filtrerade, 4 namn → 2 faktiska renders.
2. **Ingen visuell editor** som visar var text/bild landar — blint bildbibliotek, ingen klicka-placera, route 404.
3. **Bara salvia** funkar fullt.
→ Zivar kan inte leverera en snygg, unik kundsida. Därför känns det trasigt — och därför svär han.

**Vad fixar vad:**
- **goal-50 fixar (1)** — boxen med distinkta, valbara mallar (inga teman, inget bransch-filter, distinkt render).
- **(2) den visuella placera-editorn = SEPARAT spår** — klicka-redigera-i-preview-overlay (goal-37/38-territoriet som nedprioriterades; ROADMAP §E "klicka-redigera-i-preview-overlay"). Bildbiblioteket behöver en placerings-koppling.
- Båda behövs för att kundupplevelsen ska "funka". goal-50 först (boxen), sen editor-overlayn.

## ⚠️ OBS — Test Barber är en TEST-tenant (läs INNAN du bedömer fynd)
Test Barber har **ALLA moduler aktiverade för test** + testdata: egna test-uppladdade bilder (sneaker / t-shirts), test-text ("weofhowhfohogr", "KANIN FISS"), test-ordrar, och raderade test-tenants (test2, corevo-system) som ligger kvar i listor/fakturering. **Strunta i data-stöket — det är medvetet hej-vilt.** Bedöm FUNKTIONEN (att den finns och funkar som tänkt), inte hur testdatan ser ut. Glappen som ska fixas är FUNKTIONELLA (mall-val, editor, bild-placering), inte "städa testdata".

## KOD-AUDIT (5 parallella agenter, 2026-06-26) — funkar det eller är det fasad?
> Svar: det är INTE allt fasad. Mycket sparar på riktigt. Men sajtbyggaren + halva modulerna + faktura-steget är hålen. Verdikt per yta, citerat i koden.

### 🔴 AKUT BUILD-BREAKER (verifierad)
- `5-Kod/apps/web/lib/admin/shop/actions.ts` = trasig halv-sparning (208 rader, slutar mitt i `const ac`; HEAD = 335). Saknar `deleteShopProduct`, `setShopOrderStatus`, `setShopOrderTracking`, `refundShopOrderAction` som `ShopAdmin.tsx` importerar → **nästa build/deploy failar**. Fix: `git checkout HEAD -- 5-Kod/apps/web/lib/admin/shop/actions.ts`. (Prod-live opåverkad — kör committad kod.)

### ✅ FUNKAR PÅ RIKTIGT (sparar till DB — ej fasad)
- Webshop: skapa/redigera produkt, toggle Aktiv, order-status (`lib/admin/shop/actions.ts` → shop_products/variants/orders). [build-breaker ovan måste fixas först]
- Token-branding-spara (`savePlatformBranding` → tenant_settings.branding). **Clobber-buggen är REDAN FIXAD** (mergeBranding, `lib/branding/merge.ts:26`).
- Modul-toggle (Drift, `setModuleState` → tenant_modules.state, `lib/platform/tenant-modules-admin.ts:91`).
- Tjänster + pris (`updateService` → services.price_cents). ("Populär"-badge = fejk UI, ingen kolumn.)
- Personal/Scheman/Platser (invite kräver SUPABASE_SERVICE_ROLE_KEY, degraderar snällt). OBS: working_hour_slots läses ej av publika bokningsmotorn än.
- Blogg-admin CRUD · Lojalitet-intjäning (DB-trigger) · Presentkort-utfärda/spärra · Pris-modell (`saveBilling` → tenant_settings, men gömt på salonger/[id], ej på Fakturering).

### 🟡 HALVT
- **Sajtbyggar-editorn = SALVIA-ONLY.** Spar-vägen funkar (onboarding-fold + `saveSiteContent` → tenant_settings), men `theme!=='salvia'` → stub ("designas efter"). `TEMPLATE_MANIFESTS` = bara salvia → andra mallar "Okänd mall"-reject. Routen `/admin/sajtbyggare` 404:ar (dubbel-flagg-gating: SAJTBYGGARE_ENABLED + per-tenant sajtbyggare_enabled default false).
- **Blogg publik:** ingen `/blogg/[slug]` + arkiv; body hämtas men renderas aldrig — bara teaser.
- **Offert:** capture + admin-svar funkar, men NOLL mejl (båda håll) + kunden ser aldrig estimate_cents i appen.

### ❌ FASAD / SAKNAS (det Zivar känner)
- **Bild-placering:** Bildbiblioteket (`/admin/media`) = platt hög, INGEN region/slot-bindning. Placering finns bara inne i den gated salvia-editorn, 4 fasta slots (`manifest/salvia.ts:60-62,74`). Bekräftar #1-klagomålet.
- **Lojalitet inlösen + admin-justering + signup:** saknas (poäng växer, kan aldrig spenderas).
- **Presentkort köp + inlösen:** fasad (CTA inert, betal-rails obyggda).
- **Fakturering "skapa faktura":** finns INTE någonstans — by design (FLÖDE 2 = manuell läs-vy). Zivars anklagelse verifierad.
- **Super-admin Inställningar:** inget spar — tomt skal (ärligt borttaget, ej fejk-dimmat).

### Slutsats
Motorn (spar-vägarna, multi-tenant, DB) LEVER. Det som känns som fasad = sajtbyggaren (salvia-only + avstängd + ingen bild-placering) + halv-byggda modul-frontar (lojalitet/presentkort/blogg-publik/offert-mejl) + saknat faktura-steg. Code-agentens plan ska täppa dessa — börja med build-breakern.
