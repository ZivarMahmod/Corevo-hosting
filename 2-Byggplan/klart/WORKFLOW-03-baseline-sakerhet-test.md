# WORKFLOW-03 — Baseline + Rollgränser + Robusthet + Nya delar
Thinking: ⚫ Ultrathink (säkerhet + destruktiv baseline-reset + migrationer + bokningsintegritet)

> **Kör-läge: AUTONOMT hela vägen.** Code är **dirigenten** — inte en exekutor som bockar av. `/compact` när context blir hög, dö aldrig mitt i. Stanna BARA vid verklig blockerare (secret bara Zivar har / live-DNS / pengar / Zivar-beslut). Ägar-steg → markera "väntar på Zivar", jobba vidare, loopa inte.

## Så här körs den här workflowen (LÄS FÖRST)
Det här är **ingen do-lista.** Varje fas körs i **lager med en subagent-flotta**:

```
  ┌─ FÖRARBETE ─────────────────────────────────────────────┐
  │ Spawna N parallella recon-/prep-agenter på de VIKTIGA    │
  │ delarna — disjunkta revir. De GRÄVER (läser kod, repro-  │
  │ ducerar buggar, kartlägger lager, hittar glapp/risk),    │
  │ de BYGGER INTE. Varje agent levererar ett fynd-/prep-dok.│
  └──────────────────────────┬──────────────────────────────┘
                             ▼
                      SYNTES (dirigenten)
         väg ihop fynden, fatta besluten, skriv den exakta
         bygg-planen för fasen UTIFRÅN det agenterna grävt fram
                             ▼
  ┌─ BYGG ──────────────────────────────────────────────────┐
  │ Frozen/delat = SOLO. Disjunkta moduler = parallell flotta│
  │ Riktigt, inte stubbar. Varje agent verifierar sin del.   │
  └──────────────────────────┬──────────────────────────────┘
                             ▼
  ┌─ VERIFIERING ───────────────────────────────────────────┐
  │ Egen adversariell flotta som ATTACKERAR bygget (inte     │
  │ samma agent som byggde). Varje fynd reproduceras. Be-    │
  │ kräftade > råa. Säkerhetsfynd fixas direkt, re-verifieras│
  └─────────────────────────────────────────────────────────┘
```

**Poängen med flottan = förarbete och bredd.** På viktiga delar gräver flera agenter i *parallella lager* (kod / DB / RLS / flöde / realtime / ops) → planen vilar på fynd, inte antaganden.

## Mål
Ta hela Corevo Booking till en **fastställd, hållbar baseline**: ren FreshCut-demo med riktig data + salvia-tema, kunddomän-uppslag, ALLA rollgränser bevisat täta, migrationerna rekoncilerade så tabellerna stödjer varje flöde (inkl. lojalitetspoäng), bokningar som ALDRIG tyst försvinner med full spårbarhet, realtime, de nya delarna som saknas idag (multi-salong m.fl.), och hela bygget mangelat i en djup robusthet-/säkerhetstest.

## Tillägg (Zivar 2026-06-02) — robusthet, realtime, nya delar
Utöver baseline + säkerhet ska svepet också:
- **Bokningar får ALDRIG tyst försvinna.** Full spårbarhet: varje bokning + varje statusändring (skapad / ändrad / avbokad / no-show / flyttad) loggas och går att följa. En bokning kan bara byta status — aldrig hård-raderas, aldrig tappas. *(Bakgrund: en verklig bokning har betett sig galet → grundorsaken ska hittas + täppas.)*
- **Realtime.** Bokningar uppdateras live i dashboard / admin / personal (Supabase Realtime) — ingen ser en stale vy; ny/ändrad/avbokad bokning syns direkt utan omladdning.
- **Nya delar som inte finns idag:** multi-salong (multi-location) + andra parkerade delar som FAS 0 inventerar och vi beslutar om.
- **UX-ribba = "Wavy-enkelt".** FreshCut gillade hur Wavy *kändes att använda* — enkelt nog för deras kunskap. Verktyget är ett multi-verktyg under huven men ska vara lika enkelt att använda. **Enkel yta, kraftfull motor.** (OBS: gäller hur det KÄNNS/är enkelt — INTE Wavys fula externa portal, som fortfarande är anti-mönstret för storefronten.)

## Guardrails (ABSOLUTA — kör-läget upphäver dessa ALDRIG)
1. **POS orörd.** `corevo.se`/`admin`/`kiosk`/`superadmin`.corevo.se = annan produkt (Pages). Rör ALDRIG den zonens apex/POS-subdomäner. 200-koll före + efter varje deploy.
2. **Tenant-isolering = RLS + `private.tenant_id()`.** Frontend-filter är aldrig säkerhet. Gäller även **realtime-kanalen** (får aldrig läcka cross-tenant).
3. **Ingen destruktiv DB utan PITR-tidpunkt + rollback-SQL** (VÅG 2 + VÅG 3).
4. **ASCII-byggväg** (`ö` kraschar OpenNext): `robocopy <5-Kod> C:\tmp\kod /E /PURGE /XD node_modules .next .open-next .git /XF .env.local` → `pnpm --dir C:\tmp\kod --filter @corevo/web run deploy`. `/PURGE` ALLTID.
5. **Live, inte localhost.** Varje fas verifieras i browser, alla berörda roller.
6. **Rollback-ankare vid deploy:** notera worker-ver före + `wrangler rollback <id> --config 5-Kod/apps/web/wrangler.jsonc`.
7. **En bokning hård-raderas ALDRIG** av någon kodväg. Bara status-byte. (Höjs till absolut guardrail.)

## Frozen files (rörs bara SOLO)
`middleware.ts`, `lib/supabase/middleware.ts`, `packages/auth/*`, `packages/db/*`, `supabase/migrations/*`, `lib/auth/roles.ts`, root-config (`wrangler.jsonc`, `next.config.ts`). VÅG 1, VÅG 2 och goal-16 rör frozen files → SOLO, sekventiellt. Recon-flottan får läsa frozen files parallellt (ändrar inget).

---

## FAS 0 — Recon-flotta + plan-vs-kod (ingen kod ändras)
Spawna en **förarbets-flotta** (parallella läs-agenter, disjunkta revir). Väv ihop till **`2-Byggplan/FAS0-fynd-03.md`**.

- **A1 Rollgräns-lager:** läs `(admin)`/`(personal)`/`(platform)`/`(kund)`-layouter + `lib/auth/roles.ts` + middleware. Kartlägg var rollen kollas mot ytan. **Reproducera buggen live:** super_admin → `/admin` + `/personal` → vad händer, vilken tenant löses ut, läcker/tomt? Klassa: UX-glitch eller åtkomsthål.
- **A2 Migrations-lager:** diffa molnet (clylvowtowbtotrahuad) mot `supabase/migrations/`. Verifiera: `0013` saknas (0012→0014), `0014_slot_holds` ej applicerad, goal-16:s "0011" krockar med kund-identiteten. Föreslå ren framåt-numrering.
- **A3 Flödes-vs-tabell-lager:** för varje flöde (skapa/byta/ändra/lägg till tenant·tjänst·personal·schema·branding; boka/avboka/omboka; **få poäng**; betala/refund; gäst) — finns tabell+RLS+RPC? Känt glapp: lojalitet-intjäning (0013) aldrig skriven.
- **A4 Skuld-/risk-lager:** verifiera (a) gäst-avboka `cancelByToken` refundar EJ; (b) övergiven `pending` låser slot. Leta fler tysta hål.
- **A5 RLS-/säkerhets-lager:** kör cross-tenant-svit + advisor-skan som NULÄGE-baslinje (så VÅG 5 mäter mot den).
- **A6 Bokningsintegritet + realtime-lager:** spåra bokningens HELA livscykel i koden — **var KAN en bokning försvinna/tappas?** (hård-delete någonstans? misslyckad/icke-atomisk transaktion? övergiven pending? cascade-delete? statusbyte utan logg?). Vad loggas idag (audit_log-täckning på `bookings`)? Finns status-historik? Kartlägg **realtime-nuläget** (finns Supabase Realtime på bookings? publication? klient-prenumeration?). Försök reproducera den "galna" bokningen.
- **A7 Parkerat + multi-salong-lager:** inventera parkerade/ej-byggda delar (HANDOFF: multi-location-val i bokning, multi-store/franchise, super-enkel onboarding, G03b designtrohet). För multi-location: location-lagret finns (G04, `location_id` på bookings) — kartlägg vad som SAKNAS för ett riktigt fler-salongs-flöde. Lista bygg-bart-nu vs eget designbeslut.

**Syntes:** dirigenten väger ihop A1–A7, fattar öppna beslut (guard i middleware vs DAL; 0014 nu/dormant; numrering; **vilka parkerade delar byggs nu vs senare — franchise byggs INTE blint, det är eget arkitekturbeslut**), skriver exakt bygg-plan per våg. Varje high-fynd adversariellt verifierat.

DoD FAS 0: `FAS0-fynd-03.md` klar; route-bugg reproducerad+klassad; migrations-sanning fast; flödes-glapp + skuld listade; **bokningsförsvinnande-vägar kartlagda**; realtime-nuläge + multi-location-gap klart; parkerat-beslut taget.

---

## VÅG 1 — Rollgränser: ingen når fel yta (SOLO · frozen)
**Kronjuvelen.** Middleware kollar idag bara *inloggad-eller-inte* (rad ~100: "role-level authz stays in the DAL") och DAL-gränsen håller inte.

**Förarbete:** A1:s karta + en agent som skriver rollmatris-test-spec + en agent som kollar att en central guard ej bryter befintliga redirects (login-`next`, storefront-bounce). Bygg FÖRST när matris + spec är klara.

### Sluttillstånd (rollmatris)
| Roll | Får nå | Annars |
|---|---|---|
| `super_admin` | `/` (platform), `/salonger`, `/fakturering` på platform-host | tenant-yta (`/admin`,`/personal`) → redirect `/` |
| `salon_admin` | `/admin/*` för **egen** tenant | redirect `/admin`; främmande tenant → `/ingen-atkomst` |
| `staff` | `/personal/*` egen tenant | redirect `/personal`; `/admin` → `/ingen-atkomst` |
| `customer` | storefront + `/konto`,`/boka`,`/registrera` | back-office → `/ingen-atkomst` |
| utloggad | publika + `/login` | skyddad → `/login?next=` (oförändrat) |

### Bygg
1. EN central roll→yta-guard efter `getUser()` som täcker BÅDE utloggad (finns) OCH inloggad-fel-roll (glappet). En källa, inte utspridd per sida.
2. Roll + tenant ur **`app_metadata`** (aldrig `user_metadata`).
3. RLS orört — datagränsen ligger kvar; den här stänger route-/UX-hålet ovanpå.

### Verifiering (egen flotta)
Playwright: alla 4 roller, attackera varje cell i matrisen, bevisa redirect/neka. + vitest roll×yta. + RLS-cross-tenant 0 rader. Deploy + live + POS 200.
**Rollback:** `git revert` (rent tillägg).

---

## VÅG 2 — Migrations-rekoncil + lojalitet + bokningsspårbarhet (SOLO · frozen: db)
**Förarbete:** A2+A3 ger numrering + intjänings-kontrakt; A6 ger spårbarhets-glappet. En agent kartlägger var saldo LÄSES (M4); en agent verifierar pending-expiry vs M3-holds.

### Bygg
1. **Rekoncil numrering:** `0013` = lojalitet-intjäning, nästa lediga = domän (goal-16). Aldrig återanvänd nummer. Alla: additiva, `set search_path = public`, idempotenta, rollback för destruktivt.
2. **`0013` lojalitet-intjäning:** fyll `loyalty_ledger` när bokning blir `completed` (RPC/trigger, append-only, **idempotent per bokning**). → "boka → få poäng" helt.
3. **Bokningsspårbarhet (kärntillägg):** säkerställ att INGEN kodväg hård-raderar en bokning — bara status-byte. Lägg/komplettera **status-historik** (bokning, från-status→till-status, vem, när) + full **`audit_log`-täckning på alla booking-mutationer** (skapa/ändra/avboka/no-show/flytta). En bokning ska alltid gå att följa — "försvunna" = bokningar i ett tyst tillstånd, vilket nu är omöjligt.
4. **`0014_slot_holds`:** applicera bara om hold/release wiras nu; annars dormant + dokumentera.
5. **Skuld:** pending-expiry/slot-release (cron eller villkorad RPC) så aldrig-betald `pending` ej ockuperar tid för evigt — och loggar statusbytet (spårbart, inte tyst borttaget).
6. Applicera mot molnet i transaktion, AFTER-verifiera, regenerera `packages/db/types.ts`.

### DoD VÅG 2
- [ ] Numrering ren; varje migration idempotent + rollback.
- [ ] `completed`-bokning → exakt en `loyalty_ledger`-rad; omkörning dubblar ej; saldo i portal stämmer.
- [ ] **Ingen kodväg hård-raderar en bokning; varje statusändring spårbar i historik + audit.**
- [ ] Pending-expiry bevisad + spårbar. `db/types.ts` regenererad, typecheck grönt, 0 nya advisors.
**Rollback:** per migration (drop/revert-block i varje fil).

---

## VÅG 3 — Baseline: cleanup + FreshCut (goal-15) + kunddomän (goal-16)
Sekventiell. goal-16 rör `middleware.ts` (frozen) → SOLO efter VÅG 1.

**Förarbete:** en agent validerar `freshcut-seed-data.md` mot schemat (öre-priser, durations, staff_services); en agent torrkör raderings-transaktionen mot audit-guarden; en agent diffar `wrangler.jsonc routes` mot live.

### 3a. Cleanup + goal-15 (FreshCut, riktig data)
- Innehåll: **`2-Byggplan/goals/freshcut-seed-data.md`** (riktiga: namn, adress Bokhållaregatan 2, tel 073-876 71 44, 7 tjänster m. priser, riktiga öppettider, taglines). Saknad bild → salvia-default tills Zivar laddar upp.
- Kör goal-15: **PITR-tidpunkt först**, radera rent (disable audit-trigger i transaktion), seeda FreshCut (salvia-tema), 4 inloggningar (`Corevo2026!`), token-kolumner ALDRIG NULL, ingen bokningsdata. Inline-hex hålls borta (temat driver).

### 3b. goal-16 (kunddomän-uppslag)
- Kör goal-16 med **rekoncilerat migrationsnummer** (ej "0011"). RPC `resolve_tenant_by_domain` (DEFINER, `search_path=''`, `verified=true`+`status=active`). Middleware: extern host + `unknown` → async uppslag + in-memory cache (positiv+negativ TTL). `wrangler routes` → live-domäner.
- DNS/cert för riktig kunddomän = **ops-steg Zivar** (goal-16 §OPS) → "väntar på Zivar".

### DoD VÅG 3
- [ ] Ren FreshCut-baseline; salvia live på freshcut.corevo.se; riktig data; 4 roller loggar in.
- [ ] `resolve_tenant_by_domain('<test>')` → rätt slug; okänd → null; cache slår ej DB/request.
- [ ] `wrangler` dry-run = ingen detach av freshcut/booking. POS 200.
- [ ] goal-15 + goal-16 + seed-data → `_klart/`.
**Rollback:** DB → PITR; kod → revert.

---

## VÅG 4 — Nya delar: realtime + multi-salong (+ beslutat parkerat)
Nya funktioner ovanpå härdad grund. Förarbete (flotta) → bygg → verifiering.

**Förarbete:** A6 (realtime-nuläge) + A7 (multi-location-gap) ger exakt vad som saknas. En agent designar realtime-prenumerationen (vilka tabeller/filter, RLS-säkert), en agent designar multi-location-UX på "Wavy-enkel" nivå.

### 4a. Realtime
- Supabase Realtime på `bookings` (tenant-scopat, RLS-säkert — en salong ser bara sina), prenumeration i dashboard/admin/personal. Ny/ändrad/avbokad bokning syns **live utan omladdning**. Optimistisk UI där det hjälper, men servern är sanningen.
- Säkerhet: realtime-kanalen läcker ALDRIG cross-tenant (RLS på publication + filter på tenant_id). Verifieras i VÅG 5.

### 4b. Multi-salong (multi-location)
- Location-lagret finns (G04, `location_id` på bookings). Bygg det som saknas: **location-picker i bokningsflödet** (salong m. flera ställen → kunden väljer; ett ställe → hoppas över), admin **hantera flera locations** (skapa/ändra, per-location schema/personal). "Wavy-enkel" yta.
- FreshCut = 1 location → oförändrad upplevelse. Testas med en test-tenant som har 2 locations.

### 4c. Beslutat parkerat (från FAS 0-syntes)
- Bygg det FAS 0 beslutade är bygg-bart nu. **Franchise (grupp över tenants) byggs INTE blint** — eget arkitekturbeslut; om FAS 0 visar behov → eget kort, inte här.

### DoD VÅG 4
- [ ] Realtime: ny/ändrad bokning syns live i admin/personal/dashboard, ingen stale vy; 0 cross-tenant-läck på kanalen.
- [ ] Multi-location: 2-locations-tenant → picker funkar, per-location schema/personal; 1-location (FreshCut) oförändrad.
- [ ] UX "Wavy-enkel": flödena klickbara utan instruktion.
**Rollback:** revert/feature-flagga per del; realtime kan stängas av utan att bryta bokning.

---

## VÅG 5 — Djup robusthet + säkerhet (mangling)
Spawna en **adversariell test-flotta** (andra agenter än byggarna). Mangla HELA bygget inkl. nya delar. Verifiera VARJE fynd (reproducera). Bekräftade > råa. Säkerhetsfynd = aldrig polish.

### 5a. E2E-flotta — hela kedjan, alla 4 roller (live), en agent per roll-revir
- **super_admin:** skapa tenant + slug + tema + branding + ägare → faktureringsunderlag → suspend/återaktivera.
- **salon_admin:** ändra tjänster/priser, lägg till/ta bort personal, koppla tjänster, redigera schema, byt branding (live preview), toggles, sök bokningar, **hantera flera locations**.
- **staff:** schema, dagens/incheckning, drop-in/walk-in, klientkort, frånvaro.
- **customer:** registrera, boka (V3 + snabb V4), **välj location** (multi), **få poäng efter completed**, favoriter, omboka, avboka (inkl. gäst-token), Google-nudge.
- **betalning:** Stripe test-nycklar → boka m. betalning, refund vid avbokning, webhook-idempotens; annars "gatat på test-nycklar".

### 5b. Adversariell säkerhet + integritet (verifiera gränserna)
- **Rollgräns:** bryt varje cell i matrisen + främmande tenant. 0 hål.
- **Tenant-leak:** cross-tenant-svit (0 rader tvärs), PII-RPC:er anon → 42501, **realtime-kanal cross-tenant** (0 läck).
- **Bokningsintegritet:** försök få en bokning att **försvinna/tappas** (race, dubbelklick, avbruten transaktion, övergiven pending, cascade) → ska ALLTID vara spårbar, aldrig tyst borta. Bevisa status-historik + audit fångar varje övergång. Reproducera + täpp den "galna" bokningen.
- **Flödes-logik:** dubbelbokning (EXCLUDE), gapless kvitto/order-sekvens, **refund-paritet** gäst=kund/personal, no-show/refund, pending-expiry släpper slot spårbart, **multi-location-isolering** (bokning på fel location omöjlig).
- **a11y/design/UX:** 44px touch, kontrast, storefront läcker aldrig back-office-guld, "Wavy-enkel" håller, back-office = UI-kit.
- **Secrets:** klientbundle utan server-secret-namn/`service_role`.

### 5c. Triage + fix
Blockerare (säkerhet/läcka/rollhål/bokning-försvinner) FÖRST → logik → polish. Fixa bekräftade, re-verifiera, dokumentera nya anti-patterns. Allt grönt → deploy → live-smoke alla roller + POS 200.

### DoD VÅG 5
- [ ] Varje 5a-flöde körd live, alla roller, utan trasig väg (eller dokumenterat gatat).
- [ ] Rollmatris 0 brytbara celler. Cross-tenant 0 rader (inkl. realtime). PII-RPC anon-nekad.
- [ ] **Ingen testväg får en bokning att försvinna; allt spårbart.**
- [ ] Multi-location-isolering håller. Bekräftade fynd fixade + re-verifierade; 0 öppna säkerhetsfynd.
- [ ] vitest + Playwright grönt; deploy; live-smoke; POS 200.

---

## FAS SLUT — fastställ, gå live + städa
1. Uppdatera **HANDOFF.md** (nuläge, worker-ver, rollback-ankare, ägar-steg).
2. **`2-Byggplan/TESTA-DETTA-03.md`** — testlista för Zivar inkl. rollmatris-check + "försök tappa en bokning"-check han kan klämma själv.
3. **Gå live:** committa allt, **pusha till `main`**, och **deploya** (ASCII-byggväg, guardrail 4) så hela svepet är live. Notera ny worker-ver + rollback-ankare. Live-smoke alla roller + **POS 200**.
4. **Städa roten (obligatoriskt):** allt klart → rätt mapp enligt CLAUDE.md. goal-15 + goal-16 + `freshcut-seed-data.md` → `2-Byggplan/goals/_klart/`. FAS0-fynd-03 + WORKFLOW-03 kvar som logg i `2-Byggplan/`. Ta bort tillfälligt. **Roten = BARA HANDOFF/CLAUDE + config + numrerade mappar.**
5. **Rent git-träd:** efter push ska `git status` vara **rent** (inga ostaged/oträckta filer, inga halv-commits). Ändringsträdet ordnat = allt incheckat på `main`, arbetskopian ren.
6. Samla kvarvarande **ägar-steg** (Stripe test-nycklar, kunddomän-DNS väg A/B, SERVICE_ROLE_KEY om ej satt).

## Orkestreringsregler
- **Varje fas: förarbets-flotta (recon) → syntes → bygg → verifierings-flotta.** Inte en rak do-lista.
- Recon-agenter får läsa frozen files parallellt (ändrar inget). Bygg på frozen = SOLO.
- Bygg-flotta bara på disjunkta revir; en agent = en modul. Riktigt, inte stubbar; verifiera live.
- Verifierings-agenter ≠ bygg-agenter (adversariellt). Varje fynd reproducerat.
- `/compact` i tid. Vänta inte på Zivar utom verklig blockerare. Anti-loop på ägar-steg. Städa löpande.

## Slutlig DoD
Ren FreshCut-baseline live (salvia, riktig data) · kunddomän-uppslag klart · ALLA rollgränser bevisat täta · migrationer rekoncilerade + "få poäng" funkar · **bokningar försvinner aldrig, full spårbarhet** · **realtime live** · **multi-salong byggt** · hela bygget mangelat med 0 öppna säkerhetsfynd · POS orörd · **pushat till `main` + deployat live** · HANDOFF + TESTA-DETTA-03 · goals i `_klart/`, **roten ren** · **`git status` rent**.
