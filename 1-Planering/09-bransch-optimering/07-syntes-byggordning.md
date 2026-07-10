# 07 — Syntes: prioriterad byggordning (FAS 1→4)

> Syntes 2026-07-11 av rapporterna 01–06. Varje punkt = byggbar goal-kandidat med
> omfattning **S** (<½ dag), **M** (½–2 dagar), **L** (>2 dagar / flera commits) och beroenden.
> Stående regler: FreshCut fredas alltid (tema `freshcut` + tenant freshcut röres aldrig);
> frisör-defaults sätts = dagens hårdkodade värden ⇒ noll beteendeskifte; lokalt-först,
> ingen deploy utan Zivars "deploy"; varje goal verifieras mekaniskt (0 FAIL) innan nästa.

## FAS 1 — Tema-fix (akut, rapport 01)

| # | Goal-kandidat | Omfattning | Beroenden |
|---|---|---|---|
| 1.1 | **Fixa tema-steget**: `StudioPanels.tsx:451-452` slutar läsa `templatesByVertical`; lista `BUILTIN_TEMPLATES` minus `freshcut`; spegla i `CreateTenantForm.tsx`. Stänger den tysta leander-degraderingen. | **S** | Inga |
| 1.2 | **För-markera bransch-default** i tema-steget från `verticals.default_template` (DB redan frisk: zigge/salvia/linnea/leander/edit). | **S** | 1.1 |
| 1.3 | **Katalog-hygien**: filtrera `templatesByVertical` mot `STOREFRONT_THEMES` i `loadVerticalPresets` (behåll rå-datat för goal-50-galleriet). OBS: gör filtret här i stället för att slopa vägen helt — då återfår tema-steget bransch-gruppering automatiskt när FAS 4-teman landar (se konflikt K1). | **S** | 1.1 |

## FAS 2 — Bransch-kundbild (rapport 02 + 06)

| # | Goal-kandidat | Omfattning | Beroenden |
|---|---|---|---|
| 2.1 | **Vertical-normalisering + synlighet**: kundkortet läser bransch ur `tenants.vertical_id` (inte `settings.vertical`, buggen i `salonger/[id]/page.tsx:134`); bransch-badge + gruppering i `/salonger`-listan. Ingen migration. | **S** | Inga |
| 2.2 | **`/branscher` + `/branscher/[key]` read-only**: ny sidebar-post, listvy + kundbild (terminologi, modul-preset, mallar, kunder i branschen), `<details>`-mönstret från kundkortet. | **M** | 2.1 |
| 2.3 | **Skriv-UI för befintliga verticals-fält**: terminologi (`staff/service/unit` + pluraler + NYA `business`), `default_modules`, `default_template`; verifiera/addera platform_admin-write-RLS. | **M** | 2.2 |
| 2.4 | **Migration `verticals.default_services` + seed vid onboarding** (`writeTenantVerticalAndModules`) + tjänste-editor i kundbilden. | **M** | 2.3 |
| 2.5 | **Bulk-apply modul-preset** på befintliga kunder (dry-run-diff, respekterar state-vakten). | **M** | 2.3 |
| 2.6 | **Fyll terminologi-innehåll per bransch** (nagelstudio: Behandling/Nagelterapeut; restaurang: Sittning/Bord/Restaurang …) via 2.3-UI:t. Ren data. | **S** | 2.3 (mest värde efter 3A) |

## FAS 3 — Modul-beteende per bransch

### 3A — Admin-terminologi-wiring (rapport 06, ren wiring, kan gå FÖRE/parallellt med FAS 2)

| # | Goal-kandidat | Omfattning | Beroenden |
|---|---|---|---|
| 3A.1 | **`business`-nyckeln**: ny terminologi-nyckel (default "Salong") → chrome/metadata/tomlägen (~15 filer: `(admin)/layout.tsx`, `PortalSidebar.sub`, alla "Ingen salong…", installningar/platser-prosa) + webshop-adminens "Salongsadmin"-strängar (rapport 04 T1). | **M** | Inga |
| 3A.2 | **Wira `service`-nyckeln**: tjänste-fliken (`ServicesManager` får `serviceNoun/servicePlural`-props à la `BookingsClient.staffNoun`) + dashboardens "Tjänste-mix"/"Aktiva tjänster" + sax-ikonen. | **M** | Inga |
| 3A.3 | **Städa staff-rester + dashboard-KPI-gate**: `CustomerExport.tsx:37` ('Frisör'-CSV-header), scheman-prosa, kioskens drop-in-ordval; modulgate:a lojalitets-KPI:n. | **S** | Inga |

### 3B — Booking-parametrar (rapport 03)

| # | Goal-kandidat | Omfattning | Beroenden |
|---|---|---|---|
| 3B.1 | **Seed bransch-booking-defaults** för 5 verticals (frisör = exakt dagens värden: 15/0/90/alla-fält/30/24/30h) — en migration. ⚠️ Lös konflikt K2 (lagringsplats) FÖRST. | **S** | K2-beslut |
| 3B.2 | **`lib/booking/params.ts`**: helper med fallback-kedjan service→staff→tenant→bransch→konstant + enhetstester. | **M** | 3B.1 |
| 3B.3 | **Koppla slot_step + buffer + cancellation_cutoff** (`boka/actions.ts:227-228` sista ledet; bransch-led i `getCancellationCutoffHours`). | **S** | 3B.2 |
| 3B.4 | **booking_window_days**: prop till `BookingWizard` + server-validering i `createBooking` (finns inte alls serverside idag). | **M** | 3B.2 |
| 3B.5 | **guest_fields**: konfigurerbart krav (validering `boka/actions.ts:300` + wizard-required-attribut). | **M** | 3B.2 |
| 3B.6 | **reminder_hours_before + pending_ttl_min**: per-tenant/bransch i `sendDueReminders`-horisonten resp. RPC:n `expire_abandoned_pending_bookings` (DB-migration, cross-tenant-svepet). | **M** | 3B.2 |
| 3B.7 | **payment_policy** (`on_site_only`-flaggan först; prepay/deposition = ny Stripe-yta, eget produktbeslut). | **M→L** | 3B.2, produktbeslut |
| 3B.8 | **Modul-param-UI i kundbilden** (formulär ur `modules.variant_schema` → bransch-värden). | **M** | 2.3 + 3B.2 |

### 3C — Webshop per butikstyp (rapport 04)

| # | Goal-kandidat | Omfattning | Beroenden |
|---|---|---|---|
| 3C.1 | **Valuta-buggfix**: läs `order.currency` i Stripe-spåret (`app/butik/actions.ts:246,254`) — 2 rader. | **S** | Inga (kan gå när som helst) |
| 3C.2 | **Produktkategorier**: `shop_products.category` (fri text, tenant-styrd) + gruppering i `ShopSection` + adminfält. | **M** | Inga |
| 3C.3 | **Config-styrda labels** (fulfilment/promise/CTA/status-etiketter via `tenant_modules.config.labels`, coercas i `parseShopConfig`). | **M** | Inga |
| 3C.4 | **Lojalitets-redeem i kassan**: migration (ledger `shop_order_id` + redeem-RPC + release-kompensation), server-action, checkout-UI. Additiv — rör aldrig earn-triggern. | **L** | Inga |
| 3C.5 | **`pickup_asap`** (restaurang ta-hem: tidsval + öppettids-gate + kort TTL; CHECK-migration + RPC + CheckoutForm). | **L** | 3C.3 |
| 3C.6 | **Moms per produkt (`vat_rate`)** — vänta tills betal-rälsen slås på brett. | **M** | 3C.5 (restaurang-caset) |
| 3C.7 | **`shop_orders.booking_id`** (tjänst+delar, cykel) — vänta på verklig kund i branschen. | **M** | Parkeras |

### 3D — Kiosk/restaurang-beteende (rapport 06 §sist)

| # | Goal-kandidat | Omfattning | Beroenden |
|---|---|---|---|
| 3D.1 | **Kiosk-kolumn = `unit`** (bord/kapacitetsvy för restaurang; ordnivån redan klar via 3A). | **L** | 3A klar, 3B.2, riktig restaurang-kund |

## FAS 4 — Nya modulära templates (rapport 05)

| # | Goal-kandidat | Omfattning | Beroenden |
|---|---|---|---|
| 4.1 | **Tema-harness**: `verify-theme.mjs` (curl+grep, 0-FAIL-gate) + koncept-spec-mall. | **S** | Inga |
| 4.2 | **Pilottema `noir`** (barbershop, Zigge-granne) — receptet steg 1–8 end-to-end, en commit; kalibrera. | **M** | 4.1, FAS 1 klar (annars syns nya teman inte rätt i tema-steget) |
| 4.3 | **`terra` + `pärla`** (nagelstudio) inkl. `verticals.default_template`-koppling. | **M** | 4.2 |
| 4.4 | **`smak`** (restaurang, prisgrid→meny) — bevisar strukturell layout-frihet. | **M** | 4.2 |
| 4.5 | **`klara` + `verk`** (nya branschtaggar klinik/hantverk + modul-framlyft) — HÄR tas beslutet om layouter ska kunna placera modulsektioner mitt i sig. | **L** | 4.4 |
| 4.6 | **`bris` + `atelje`** — volymproduktion, ~1 tema/run. | **M** | 4.5 |

## ⚠️ Konflikter mellan rapporterna

- **K1 — Tema-steget vs templates-tabellen (01 vs 05).** Rapport 01:s minsta fix säger "sluta läsa `templatesByVertical`, lista alltid `BUILTIN_TEMPLATES`"; rapport 05:s recept DB-registrerar varje nytt tema i `templates` och förlitar sig på att wizarden grupperar på `tags.bransch`. Görs 01-fixen bokstavligt tappas bransch-grupperingen för FAS 4-temana. **Lösning (vald i 1.3):** filtrera `templatesByVertical` mot `STOREFRONT_THEMES` i stället för att slopa vägen — då är både 01-buggen stängd och 05-receptet intakt.
- **K2 — Var bor bransch-modulparametrar (02 vs 03).** Rapport 02 föreslår NY kolumn `verticals.module_params` och säger uttryckligen "rules lämnas för framtida bransch-regler — konflatera inte"; rapport 03 lägger exakt samma booking-parametrar i befintliga `verticals.rules.booking`. Samma data, två hem. **Rekommendation:** följ rapport 03 (`rules.booking`) — kolumnen finns redan, ingen migration av schema-form behövs, och "rules" var reserverad för just detta; rapport 02:s kundbilds-UI (3B.8) pekas om till `rules.<module_key>`. Beslutet MÅSTE tas före 3B.1.
- **K3 — Två override-hem på tenant-nivå (02 vs 04).** Rapport 02 lägger tenant-terminologi-override i `tenant_settings.settings.terminology`; rapport 04 lägger shop-label-overrides i `tenant_modules.config.labels`. Ingen hård kolission (terminologi = tvärgående ord, labels = modulspecifika strängar) men gränsen behöver dokumenteras i kundbilds-goalen så inte samma ord hamnar på två ställen.
- **K4 — Ordningsspänning FAS 2 vs 3A.** Rapport 06:s wiring (3A) kräver ingen kundbild och ger direkt bransch-känsla — men får verkligt INNEHÅLL först när 2.3+2.6 (terminologi-editor + data) finns. Ingen blockering (resolveTerm-fallback = dagens ord), men kör 3A och FAS 2 parallellt så de möts i 2.6.

## Rekommenderad exekveringsordning (sammanvägd)

1. **1.1–1.3** (tema-fix, S+S+S — en dags arbete, stänger akut bugg)
2. **3C.1** (valuta-fix, 2 rader) + **2.1** (vertical-normalisering) — små oberoende fixar
3. **3A.1–3A.3** (admin-wiring) parallellt med **2.2–2.3** (kundbild read-only → skriv)
4. **K2-beslut → 3B.1–3B.3** (booking-params: seed + helper + slot/buffer/cutoff)
5. **2.4–2.6** (default-tjänster, bulk-apply, terminologi-innehåll)
6. **3B.4–3B.6** + **3C.2–3C.3** (fönster/gäst-fält/reminder-TTL; kategorier/labels)
7. **4.1–4.2** (harness + noir-pilot) → **4.3–4.6** (tema-batchen)
8. **3B.8** (param-UI i kundbilden) + **3C.4** (lojalitets-redeem)
9. Sist/behovsstyrt: **3B.7** (payment_policy), **3C.5–3C.6** (restaurang-fulfilment/moms), **3D.1** (kiosk-unit), **3C.7** (booking-koppling)
