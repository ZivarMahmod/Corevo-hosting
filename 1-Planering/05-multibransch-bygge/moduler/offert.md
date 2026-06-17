# Modul: Offert (offert)

> En fil per modul. Följer `10-arkitekturprincip-universal-vs-variant.md` (EN universal motor, anpassning = config). DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §1.3 + migration `5-Kod/supabase/migrations/0033_offert_module.sql`. Status: ✅ **LIVE** (rad i `modules`, tabell `offert_requests`, RLS på).

## 1. Kärna (universell)
En besökare beskriver ett behov där priset inte är fast → en rad skapas i `offert_requests` → företaget svarar manuellt med en offert i admin. EN modul, EN tabell, alla branscher. Betal-rails pausade (beslut 14.2) — en offert är **underlag**, rör inga pengar. Anon får INSERT (skicka förfrågan utan konto), aldrig SELECT (förfrågningar är privata). Statuskedjan flyttas av personal i admin. Filuppladdning (ref-bild) går till `media_assets`.

## 2. Universal vs variant — beslut + axlar
**Variant, aldrig fork.** Skillnaden mellan florist och bilverkstad är *vilka fält som visas* och *hur svaret tas emot* — ren data/config. Axlar:
- **`variant_schema.mode`** (enum, snapshottas på raden vid inskick): `request_quote` (fritext-behov → manuellt svar) · `estimate_form` (kund väljer fördefinierade poster → ej bindande prisuppskattning sparas i `details` + `estimate_cents`) · `callback` (kontakt + kort behov → "vi återkommer"). Default `request_quote`. Params: `estimate_form.response_days` (def 2), `callback.response_days` (def 1).
- **Fält per bransch** = config (renderas dynamiskt), INTE kolumner. Lagras i `details` (jsonb). Branschens preset väljer default-`mode` + fältuppsättning.
- **`verticals.terminology`** styr orden (Servicetyp vs Plaggtyp vs Arrangemang).
- **`tenant_modules.config`** = per-kund-finjustering ovanpå branschens default (egna fält, egen `response_days`, egen `mode`).
- **Leder-till-flöde** (tatuering → booking+deposit; städ → recurring) = mjuk koppling i app-lagret, ingen ny offert-variant. Offert äger bara förfrågan.

## 3. Per bransch
| Bransch | variant-val (mode) | UI-skillnad (fält) | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Florist 🌱 | request_quote | Tillfälle (bröllop/event) · Datum · Antal gäster · Budget · **inspo-bild** (media_assets) | Stor-/eventbeställning → florist svarar med arrangemangsförslag + pris | Bröllop/event prissätts unikt; bilden styr stil |
| Bilverkstad 🌱 | request_quote | Servicetyp · Regnr · Märke & modell · Önskat datum · **felbeskrivning + bild** | Fel beskrivs → verkstad uppskattar → leder ofta till booking + orderstatus | Reparationspris går ej att lista; bild av skada hjälper |
| Tatuering 🌱 | request_quote | Storlek (cm) · Placering · **referensbild OBLIGATORISK** · Beskrivning | Förfrågan → artist svarar → **leder till booking + deposit** (depositgrind) | Motiv/storlek avgör pris+tid; ref-bild är ovillkorlig; no-show dyrt → deposit |
| Städ 🌱 | estimate_form | Yta (kvm) · Typ av städning · Frekvens · Adress | Parametrar → grov prisuppskattning → **leder till recurring** (abonnemang) | Kvm×frekvens ger räknebar uppskattning; städ är återkommande |
| Fotograf 🌱 | request_quote / estimate_form | Typ av shoot · Antal timmar · Antal bilder · Plats · Datum | Timmar/leverans → paketförslag | Paketpris varierar med tid+leveransomfång |
| Skräddare 🌱 | request_quote | Plaggtyp · Material · Ändring eller nytt · Klart senast | Förfrågan → offert → leder ofta till inlämning + orderstatus | Ändring vs nysytt skiljer pris radikalt |
| Cykel 🌱 | request_quote | Vad gäller det? · Märke & modell · Beskrivning · Önskat datum | Standard offertformulär (enkel) | Mest enkel service-förfrågan; kan ledas till inlämning |
| Frisör ✅ / Barbershop ✅ / Nagel ✅ | (default off) | — | Offert default av — pris är listat | Fast prislista, ingen offert behövs |
| Restaurang ✅ / Café 🌱 | (default off) | — | Offert default av (ev. catering-förfrågan senare) | Meny/bord prissätts fast |
| Optiker 🌱 / Hund 🌱 / Klinik 🌱 / Second hand 🌱 | (default off) | — | Ej offert-driven | Andra moduler bär behovet |

## 4. DB-form (LIVE)
**Tabell `public.offert_requests`** (migration 0033, finns):
- `id` uuid PK · `tenant_id` uuid NOT NULL FK→tenants (cascade) · `customer_id` uuid FK→customers (set null, känd kund om inloggad)
- `customer_name` · `customer_email` · `customer_phone` (kund kan vara anon)
- `mode` text NOT NULL CHECK in (request_quote, estimate_form, callback) — snapshot av vald variant
- `subject` · `message` (fritext) · `details` jsonb NOT NULL def `{}` (estimate_form-poster + branschfält) · `estimate_cents` int CHECK ≥0 (nullable) · `currency` text def SEK
- `status` text NOT NULL CHECK in (**new, reviewing, quoted, accepted, declined, closed**) def new
- `payment_status` text CHECK in (unpaid, paid, refunded) def unpaid (ren kolumn, ingen provider — rails pausade)
- `note` text (intern) · `created_at` · `updated_at` (trigger `set_updated_at`)
- Index: tenant, (tenant,status), customer.

**RLS** (finns): `offert_requests_rls` for all to authenticated `using/with check (tenant_id = private.tenant_id() OR is_platform_admin())`. `offert_requests_public_insert` for insert to anon `with check (true)` (app-lagret sätter tenant_id). **Ingen anon SELECT.** Grants: insert→anon+authenticated; select/insert/update/delete→authenticated.

**Referensbild:** lagras i `media_assets` (befintlig), id refereras ur `details` (ej egen kolumn).

## 5. Två ytor — Storefront + Admin
- **Storefront** (`5-Kod/apps/web/components/storefront/OffertSection.tsx` + `OffertForm.tsx`, `lib/storefront/offert/load-offert.ts`): formulär gatat på `tenant_modules.state='live'`. Fält renderas per bransch/`mode`. INSERT i `offert_requests` (anon). Bekräftelse "Svar inom N dagar". MODULE_FACE sf: *"Besökaren skickar en offertförfrågan via formulär."*
- **Admin** (`5-Kod/apps/web/components/admin/OffertInbox.tsx`, design `kund-admin/surfaces-more.jsx` → `Offerter`): inkorg-lista (kund, vad, när, status-badge). Åtgärder: "Svara med offert" (sätt `estimate_cents`, flytta status), "Visa". MODULE_FACE adm: *"Ägaren läser förfrågningar och svarar med offert."* Tändes-not visas eftersom kunden aktiverat Offert.

## 6. Verklighets-koll
- **Status-mismatch (löst, DB vinner):** designens cfg-data säger *"ny → besvarad → accepterad/avböjd"*; DB+kod använder `new/reviewing/quoted/accepted/declined/closed`. **Bygg mot DB-enumet.** UI-etiketterna får vara svenska (Ny/Granskas/Offererad/Accepterad/Avböjd/Stängd) men *värdet* är det engelska enumet.
- **`mode` är snapshot, inte live-config:** raden bär den variant som gällde vid inskick — ändrar tenant `mode` senare påverkas inte gamla rader. Korrekt.
- **Anon-INSERT-fälla:** anon får skapa men inte läsa. Spam-risk → `check_rate_limit(...)` (finns i DB §8) bör gatas in i formuläret.
- **Lätt missat:** obligatorisk ref-bild för tatuering måste valideras i app-lagret (DB tvingar inte); "leder till booking/deposit/recurring" är app-orkestrering, inte en kolumn — håll offert ren.

## 7. Status idag vs bygg
- **Finns:** modules-rad, `offert_requests` + RLS (0033), storefront-form, admin-inbox, loader. Detta är den enda av de fyra modulerna som är LIVE.
- **Bygg/justera:** verifiera per-bransch-fält-config (data-driven, ej hårdkodat per `if(bransch)`); koppla ref-bild-upload→media_assets fullt; gata rate-limit; mappa svenska UI-etiketter mot DB-enum; mjuka "leder-till"-länkar (booking/deposit/recurring) som app-flöden i fas D.

## 8. Öppna beslut för Zivar
1. **Estimate-form prislogik:** ska `estimate_cents` räknas automatiskt ur `details` (kvm×taxa) eller alltid sättas manuellt av personal? (Påverkar städ/fotograf.)
2. **"Leder till"-koppling:** ska accepterad offert auto-skapa booking-utkast / trigga deposit / starta recurring, eller är det manuellt? (Tatuering + städ.)
3. **Ref-bild obligatorisk** per bransch — config-flagga i `variant_schema` eller bara app-validering?
4. **Catering-offert** för restaurang/café — egen branschpreset senare eller utanför scope nu?

## 9. Källor
- DB-sanning §1.3 + §4.2: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md`
- Migration (kanon): `5-Kod/supabase/migrations/0033_offert_module.sql`
- Variants/faces/branscher: `4-Dokument-Underlag/01-acceptans/super-admin/cfg-data.js` (MODULES.offert, MODULE_FACES, BRANCHES), `super-admin/preview.jsx` (ModOffert)
- Admin-UI: `kund-admin/surfaces-more.jsx` (Offerter) · kod: `apps/web/components/{storefront/OffertForm,admin/OffertInbox}.tsx`
- Princip: `10-arkitekturprincip-universal-vs-variant.md` · Backlog: `09-modul-bransch-spec-backlog.md`
