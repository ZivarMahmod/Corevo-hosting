# ROADMAP — Corevo, hela vägen till launch

> **Produktdefinition (KANON):** `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`.
> Corevo = EN motor/DB/kodbas · moduler à la carte per kund · mallar per bransch · sajtbyggare för vilken bransch som helst. **Frisör = EN bransch, aldrig projektet.**
> Detta är **den enda roadmapen**. Konsoliderad 2026-06-18 (storstädning: −91 md, −~590 döda kodrader, doc-spine bias-fixad). Ersätter ROADMAP-2026-06-17 + MASTER-LISTA + FINSLIP-TODO + FRÅGOR-TILL-ZIVAR + INVENTERING.

---

## 📍 NULÄGE — vad som FAKTISKT funkar (alla 5 ytor = "real", kod-verifierat denna session)

| Yta | Status | Funkar idag | Största gap |
|---|---|---|---|
| **Super-admin** (superbooking) | ✅ real | salongslista/detalj (6 flikar), **Onboarding-studio (goal-48, 12 steg + live-preview, live)**, **modul-toggle per kund** (off→draft→live→paused, slår igenom på storefront direkt), branding/roller/billing/domän-skrivvägar | fristående sajtbyggare-redigering AV en BEFINTLIG kundsida (utanför onboarding) kvar; settings-reglage stubbade; telemetri saknas |
| **Kund-admin** (booking/admin) | ✅ real | dashboard live, alla modul-ytor (shop/blogg/offert/lojalitet/presentkort) modul-gatade, sajtbyggare-självservice (SiteEditor → `tenant_settings.copy/branding`, live **utan deploy**) | **sajtbyggare SALVIA-ONLY** (null för andra teman → Callout); textarea ej TipTap (v0); sektionsordning låst i layout-koden |
| **Personal** (minbooking) | ✅ real | "Idag" dag-kalender + "nästa kund", walk-in, markera klar, arbetstider-veckogrid, frånvaro (time_off) | launch-redo; gapen = designval (ingen datum-nav, inget approval-flöde) |
| **Kund** (/konto) | ✅ real | bokningar/historik, lojalitetssaldo + tier, favorit-personal, **bransch-terminologi-overlay** (portalen talar tenantens bransch), profil + GDPR-export | AccountPrivacy namn-läge är **read-only** (ingen kund-anropbar spar-action) |
| **Storefront** (publik) | ✅ real | 5 genuint distinkta tema-layouter + owner-copy, modul-sektioner per livscykel, boka-flöde bransch-medvetet, sajtbyggare-edits når live | **🔑 renderas via 5 HÅRDKODADE `STOREFRONT_LAYOUTS`, EJ DB-template-slots** — sektioner + ordning låsta i kod = **TEMPLATE-BRON** (det stora spåret, se B) |

**Moduler:** 7 live i DB (booking · shop · offert · blogg · lojalitet · presentkort · media_library) + **9 namngivna ej byggda**. Per-branch-anpassning = **4 datalager**, aldrig fork:
1. `modules.variant_schema` (enum+params, t.ex. `shop.fulfilment` = ship/pickup/order-in)
2. `verticals.rules` (objekt/capture, t.ex. `booking.object` = table vs slot)
3. `verticals.terminology` (UI-ord: Stylist/Mekaniker, Klippning/Rätt)
4. `tenant_modules.config` (per-kund-finjustering)
**Regel:** skillnad uttryckbar som data → VARIANT på befintlig modul · kräver ny tabell → NY modul (universell + togglad) · **ALDRIG kundkod**. Ny bransch = 1 `verticals`-rad = noll kod.

**DB-hälsa:** schemat är KOMPLETT och ligger före koden (migr 0026–0038, RLS på allt). Tomma modul-tabeller = flödet ej byggt, **inte** schema som saknas → build-backlog, inte DB-fel.

**Denna session gjort:** doc-spine bias-fixad (CLAUDE/HANDOFF/MEMORY + canon → multi-bransch) · −91 md · −~590 döda kodrader (10 @deprecated/stub-filer) · −grapesjs-dep · −3 döda env-nycklar.

---

## 🔴 LAGKRAV — måste lösas FÖRE/VID launch

- **In-app ångerfunktion / självservice-avbokning = LAGSTADGAD fr 2026-06-19.** ⚠️ Avboka-flödet (`/avboka/[id]`, `cancelByToken`) **FINNS redan** → **verifiera att det uppfyller kravet** (kund kan avboka själv utan att ringa). Trolig quick-win: säkerställ knappen syns i /konto + i bekräftelsemejlet.
- **Distansavtalslagen 14-dagars ångerrätt** → påverkar deposit/no-show-design (ej byggt).
- **GDPR Art.28 DPA per kund** (biträdesavtal vid onboarding) — saknas.
- **SCA/3DS för EEA-kort** + `charge.dispute.*`-webhooks — när betalning aktiveras.
- Review-gating är OLAGLIGT (FTC 2024) → om recensioner byggs: neutral feedback till alla.
- (Detaljerat underlag kvar i `3-Bakgrund-Research/avbokning-lag-*` + `gap-analys-*-DJUP`.)

---

## 📜 LICENS-GRIND — blockerar mall-utrullning (template-bron)

- **102/110 vendor-mallar = CC-BY 4.0** (htmlcodex/colorlib/themewagon m.fl.): kommersiell användning + modifiering OK, **MEN författar-credit i footern MÅSTE behållas** tills "Credit Removal License" köps **per mall** (htmlcodex.com/credit-removal). Att rendera som SaaS = "use" (tillåtet); aldrig sälja/återförsälja mallen fristående.
- **KOLLISION:** ombrandnings-regeln "Corevo-branding" (KATALOG.md) krockar med CC-BY → kundsidor måste behålla credit tills köpt.
- **~5 mallar = MIT** (materio, sneat — helt fria, ingen attribution). **2 kräver köp** (51 hotelier, brber — oanvändbara tills köpta). 1 okänd (razor) → manuell granskning.
- **Regel:** bygg template-bron på **FRIA MIT-mallar först**; CC-BY parkeras bakom licens-beslut. Inget får gå till `02-valda/` utan att licensraden stämmer (`KATALOG.md`-gaten är aktiv).

---

## ▶️ ORDNINGEN — rak väg, en sak klar innan nästa

### A · Lagkrav + lågt hängande (NU, snabbt)
- **Ångerfunktion:** verifiera att avboka uppfyller lagen; annars lyft avboka-knapp till /konto + mejl.
- **Bias-fixar (diff-0):** de 4 high + ~19 leaf-etiketter via `resolveTerm`/staff-noun (förra diagnosen). Ny `resolveServiceNoun`-helper för hårdkodat "Tjänst" (wizard/kvitto/avboka), speglar staff-noun.
- **AccountPrivacy:** ge namn-läget en spar-action (kund-yta-gap).

### B · TEMPLATE-BRON — bryter storefront-loopen (det stora spåret)
- ✅ **Slice 1 KLAR (goal-47, i main + live, byte-identisk):** storefront-läsvägen för DB `content_slots` finns bakom flagga (`should-render-db`); 0 authored slots i prod → gaten false = byte-identisk render.
- ✅ **Template-bron 4→2→1 KLAR + RENDER-VERIFIERAD LIVE (2026-06-26, tag `v1.0.9`):** (4) salvia reconcilad till EN kanonisk slot-modell (migr `0040`) · (2) out-of-band mall-katalog fångad i migrations-historik (`0041`, repo==live) · (1) storefront renderar `content_slots` via `applySkinOverlay` (gatat på authored, ej present-värde). test-barber renderar nu rik SalviaLayout m. hub-bilder (skelett-regression borta, 0 FAIL). Kvar = resten nedan + goal-36.
- Koppla **publik storefront → DB-template-slots** (`templates`/`template_slots` → `content_slots` via skin-loader som redan finns men är inert: `lib/storefront/skin/load-skin.ts` — wire:a den).
- Ta bort `parseTheme`-allowlisten (lib/tenant-data.ts, 5 nycklar) → DB-mallnycklar (restoran/foody/polish…) får renderas i st f silent-downgrade till leander.
- Default-copy/media per **bransch** ur slots, ej frisör-hårdkodning i `theme-content.ts`/`images.ts`.
- Editorn skriver `content_slots` (idag `tenant_settings`).
- = **goal-36** (~94 byggbara katalog-mallar) blir verklig. **Bygg på MIT-mallar först** (licens-grind).
- ⚠️ Design-känsligt (18h-fällan) → render-verify **0 FAIL** + oberoende verify. (Behåll `sajtbyggare-spike/*` — det är LÅST-B draft-preview-render, ej skräp.)

### C · Moduler "på riktigt" (end-to-end per modul)
- ✅ **Webshop → goal-49 KÄRNAN KLAR + DEPLOYAD LIVE (tag `v1.1.0`, 2026-06-26):** kundvagn → kassa → `create`/`confirm_shop_order` (held-order + reserved_qty, variant-grain) → bekräftelse → /konto/bestallningar; merchant-admin (variant-sync/order-detalj/spårning/refund/analytics); hel Stripe-rail bakom `payments_enabled` (AV). Render-verifierat live (test-barber shop=live). **Kvar v1.1:** rabatt/frakt/moms-config + multi-variant-UI; live kort-betalning = compliance-gate. Underlag: `gap-analys-webshop-2026-06-26.md`.
- **Blogg** (HALV): publik artikelsida `/blogg/[slug]` (+ arkiv) med full body + SEO. *(Idag bara teaser, ingen läs-mer-länk.)*
- **Lojalitet** (HALV): inlösen (poäng→rabatt) + signup-räls + admin-justering. *(Intjäning-trigger + kund-vy finns.)*
- **Presentkort** (HALV): publikt köp + inlösen. *(Admin utfärdar/spärrar redan.)*
- **Offert** (klar kärna): nästa nivå = mejlnotis vid ny förfrågan + offertbelopp tillbaka till kund.

### D · Bredd — per riktig kund, build-once
- **booking bransch-medveten** (bord/slot/drop-off via `verticals.rules`) = **enda riktiga nybygget i modul-lagret**. → onboarda **1 riktig icke-frisör live** (t.ex. restaurang) = bevisar multi-bransch.
- **9 nya moduler** prio: `fordon` → `recurring` → `meny` → `portfolio` → `orderstatus` → (legal/rails-fördröjt: `intag`, `deposit`, `inlamning`). Specar i `05-multibransch-bygge/moduler/`.
- **Nya branscher** = 1 `verticals`-rad/kund, noll kod (bilverkstad, café, hundsalong, klinik, florist, tatuering, cykel…).

### E · Fakturering + drift
- **Billing:** 399 kr/mån platt, super-admin→salong-faktura, Swish-QR manuell v1 ("jag har betalat" → Zivar Godkänner) → auto sen, moms 25 %, användningsräknare. *(Ej byggt; betalningar pausade.)*
- **Kända buggar:** `savePlatformBranding`-clobber (seeda media→ta bort→spara) · personal-"Idag"-krasch · poäng-revoke completed→cancelled (FÖRE redeem) · **onboarding: orphan-salong vid invite-fail** · **onboarding: Auth-verifieringsmail funkar ej** (de två onboarding-buggarna FÖRST i onboarding-v2).
- ✅ **Onboarding-v2 → KLAR (goal-48 Onboarding-studio, live i prod 2026-06-26, flagga ON):** full 12-stegs studio på superbooking — bransch-start (ej bur) · fri tema-val · live-helsides-preview hela vägen · modul av/på + bokningsvariant i wizard · tjänster+priser (services.price_cents) · hero-text (settings.copy, alla teman) · ärlig resultat-vy · full-bleed-layout. Gates tsc0/vitest694, varje våg oberoende reviewad. **Kvar (egna småspår, EJ del av studio-scopet):** modul-ordning (dra) kräver per-tenant ordning-läsväg i storefronten · auto-koppla `<slug>.corevo.se` vid onboarding (idag separat `add-domain.mjs`) · klicka-redigera-i-preview-overlay (fälten gör samma sak idag).

---

## ❓ ÖPPNA BESLUT — beta av i ett pass (blockerar B+)

> **✅ LÅST 2026-06-19 (Zivar):** scope = **maximalt** (alla moduler + flera branscher FÖRE kund #1) · betal-rail = **Stripe Connect** (⚫ compliance-gate: SCA/3DS + dispute-webhooks + refund-paritet före riktig charge) · licens = **behåll credit i footern** (CC-BY körbara nu, credit kvar tills köpt per mall — ej MIT-begränsad) · tempo = **allt bakom flagga, noll kund till slut** (bevisa varje våg på staging-testtenant, ej publik). Kvar att klubba: schema/booking 1–5 + infra/pengar + produkt nedan.

**Schema/booking:** 1) booking `object:table`-kapacitet (restaurang-bord, `party_size`/`address`-kol, rör `no_double_booking`) · 2) intag rättslig grund (patientdatalag 2008:355 + DPA, klinik) · 3) namn `vehicles`/`pets` · 4) café-lojalitet earn-source (trigger på `shop_orders`) · 5) booking `variant_schema`/`rules`-bekräftelse.
**Infra/pengar:** Workers Paid 48 kr/mån nu? · Supabase spend-cap? · PITR-backup (+950 kr) när? · domän-modell (kund äger + CNAME, reko A) · **betal-rails-ordning (ES-API vs Swish vs Stripe — störst, låser policy-motorn)** · **license-beslut** (köp bort credit / behåll credit / kör MIT-only).
**Produkt:** per-location-pris vs platt · redeem-poäng när · deposit-toggle (parkerad OK) · reveal-on-scroll (canon: bort).

---

## 🧾 VERIFY-SKULD — byggt men aldrig live-bevisat (testa före launch)

mejl end-to-end (boka→bekräftelse + SPF/DKIM) · realtime 2-flikar · kundregistrering `/registrera` (service-role) · **RLS-isolering salong A↔B** · cron-triggers (reminders + pending-expiry) · export-knapp Salonger äkta? · notis-bell + ⌘K-täckning · SMS 46elks hela kedjan · onboarda salong från noll end-to-end.

---

## 🧭 Spelregler

- **En sak → verify → `klart/`.** "Klart" = bevisat live, aldrig "kod committad".
- **Universal motor + variant per bransch — ALDRIG fork.**
- **Build once, activate per kund.** (Build-once-never-delete återinförs efter denna engångs-städning.)
- **POS `corevo.se` + de 3 fasta hostarna får ALDRIG gå ner** vid deploy.
- **Deploy-first:** bevisa innan mer byggs.

---

*Referenser (kvar i repot): modul-specar `1-Planering/05-multibransch-bygge/moduler/` (16) + `09-modul-bransch-spec-backlog` + `10-universal-vs-variant` · canon-arkitektur + DB-schema + ADR-01 + domänstrategi `1-Planering/01-arkitektur/` · acceptans-paket `4-Dokument-Underlag/01-acceptans/` (design-LAG) · license-gate `4-Dokument-Underlag/03-template-katalog/KATALOG.md` + `KATALOG-RAPPORT.md` · ops-runbooks `5-Kod/docs/ops/` · öppna goals `2-Byggplan/goals/` (36, 39–45) + fix `2-Byggplan/fix/` (25, 26) · research `3-Bakgrund-Research/` · sajtbyggare-inriktning `1-Planering/06-sajtbyggare/`.*
