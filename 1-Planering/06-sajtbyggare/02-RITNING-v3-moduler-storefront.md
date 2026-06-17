# 02 — RITNING: v3-design → verklig kod (modul-lagret på storefront)

> Skapad 2026-06-17 (Cowork). **Syfte:** översätta design-paketet (`4-Dokument-Underlag/01-acceptans/`)
> till exakt vad Code ska göra med modulerna — så Code bygger **rätt** (de 7 live, trohet mot v3)
> och **inte fel** (bygger inte om det som finns, rör inte de 8 roadmap).
> Grundad i recon av riktiga kodläget 2026-06-17 (ej gissat).

---

## 0. Kärnreglerna (läs först)

1. **7 live byggs/justeras. 8 roadmap rörs ej.** Källa: `01-acceptans/super-admin/cfg-data.js` `live:true/false`-fältet. Roadmap-moduler märks «Roadmap» i studion, deployas ej, **raderas ej**.
2. **Modul-sektionerna FINNS REDAN** (goal-30, K10–K20). S3-jobbet = **design-trohet mot v3**, INTE nybygge. Bygg inte om.
3. **Utseende-källa = LAG:** `01-acceptans/super-admin/preview.jsx` (`Mod*`-komponenterna) + `01-acceptans/kund-admin/surfaces-*.jsx`. Lyft exakta px/hex/font därifrån — aldrig ögonmått, aldrig re-härleda.
4. **DB vinner** vid krock (`02-Arkitektur-sanning.md`). Tabellnamn nedan = de riktiga (verifierade mot migrationer 0028–0036).

---

## 1. Modul-matris — finns NU vs v3-mål vs delta

| Modul | Storefront-komp (NU) | Admin-komp (NU) | v3-rendering (källa) | DELTA Code ska stänga | DB-tabeller | live |
|---|---|---|---|---|---|---|
| **booking** | `components/booking/BookingWizard.tsx` + BookingMount vid markör | (core) | `preview.jsx` `ModBooking` | **Bransch-medveten saknas** (bord/party_size) + trohet | bookings, services, staff, staff_services, working_hours, time_off, slot_holds | ✅ |
| **shop** | `components/storefront/ShopSection.tsx` | `components/admin/ShopAdmin.tsx` | `ModShop` | Endast trohet (grid/kort mot v3) | shop_products, shop_orders, shop_order_items | ✅ |
| **offert** | `components/storefront/OffertSection.tsx` | `components/admin/OffertInbox.tsx` | `ModOffert` | Endast trohet (formulär) | offert_requests | ✅ |
| **lojalitet** | `components/storefront/LojalitetSection.tsx` | `components/admin/LojalitetAdmin.tsx` | `ModLojalitet` | Endast trohet (progress/stämpel) | loyalty_ledger | ✅ |
| **presentkort** | `components/storefront/PresentkortSection.tsx` | `components/admin/PresentkortAdmin.tsx` | `ModPresentkort` | Trohet (rails pausade — UI only) | gift_cards | ✅ |
| **blogg** | `components/storefront/BloggSection.tsx` | `components/admin/BloggAdmin.tsx` | `ModBlogg` | Endast trohet (grid/lista) | blog_posts | ✅ |
| **media_library** | — (ingen publik yta) | `components/admin/MediaLibrary.tsx` | — (infra) | Inget — INFRA, aldrig en sektion | media_assets | ✅ |

> **Slutsats:** 6 av 7 har redan storefront+admin. Det enda **nybygget** i modul-lagret är booking-bransch-medvetenhet (§2). Allt annat är **trohet** = justera mot v3, inte skapa.

---

## 2. Booking bransch-medveten (enda riktiga nybygget)

- **NU:** `BookingWizard.tsx` kör bara `wizard`/`compact`-läge, generiskt `staff`/`service`. Inte bransch-medveten (bekräftat recon + `S0-UTFALL.md` §7).
- **MÅL (arketyp-modellen, EN motor + profil per arketyp — config, ej hårdkod per kund):**
  - **Arketyp A** (frisör, barber, nagel, klinik, mekaniker) = tid + person. **Funkar redan.**
  - **Arketyp B** (restaurang) = **bord / party_size, ingen personal/tjänst.** Härleds ur `verticals.rules.booking.object='table'`.
- **Källa för beteende:** `01-acceptans/super-admin/cfg-data.js` → `MODULES.booking.variants.*` + `BRANCHES.*.rules`.
- Detta = "**bokning per bransch**" i `07-efter-sajtbyggaren/00-agenda.md`. Eget, avgränsat spår.

---

## 3. Live/roadmap i onboarding-studion

- Modulväljaren ska visa **7 live valbara** + **8 roadmap märkta «Roadmap»** (`live:false`), ej deploybara.
- Källa: `01-acceptans/super-admin/cfg-data.js` (`live`-fält per modul/bransch) + `02-Arkitektur-sanning.md` §0b.
- Ny bransch = en `verticals`-rad (billigt). Ny modul = tabell + RLS + `modules`-rad (dyrt, bara på riktig kund + Zivar-OK).

---

## 4. Vad Code INTE ska göra (loop-skydd)

- ❌ Bygg INTE om de 6 modul-sektioner som finns — justera mot v3.
- ❌ Bygg INTE de 8 roadmap-modulerna (portfolio, husdjur, fordon, intag, orderstatus, recurring, deposit, meny, inlamning) — ingen tabell. Märk bara «Roadmap».
- ❌ Skapa INGA nya tabeller/migrationer utan Zivars uttryckliga go (schema bara på go).
- ❌ Rör INTE betal-rails (pausade, beslut 14.2) — UI ja, pengar nej.

---

## 5. Var detta möts sajtbyggaren (S-stegen)

- **S1 (goal-34, pågår):** redigerbara regioner + override-kaskad (Universal→Bransch→Kund) + `data-editable`-markörer. **Rör ej modulerna.** Ritningen rör inte S1.
- **S3:** väv in de 7 live via `<corevo-module>`-markörer (render-bron finns: `lib/sajtbyggare/render-bridge.tsx`) + **trohet-pass mot v3**. **Matrisen i §1 = S3:s kravlista.**
- **Verify per modul (design-trohet-lag):** acceptans-test i stil med `probe.js` mot v3-renderingen → **0 FAIL**, aldrig ögonmått. Oberoende verify (byggaren rättar ej egen läxa).

---

## 6. Ordning (respekterar låst A→B→C→D)

1. S1 (goal-34) först — huset/regionerna. Modulerna orörda.
2. Booking bransch-medveten (§2) — kan köras parallellt som eget spår (arketyp B).
3. S3 trohet-pass (§1) — när S1 + render-väven står.
4. Bredd (de 8 roadmap) = Fas D, EFTER A→B→C. Inte nu.
