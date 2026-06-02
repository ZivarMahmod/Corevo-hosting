# WORKFLOW-03 — Baseline + Rollgränser + Djup robusthet/säkerhet
Thinking: ⚫ Ultrathink (säkerhet + destruktiv baseline-reset + migrationer)

> **Kör-läge: AUTONOMT hela vägen.** Code är **dirigenten** — inte en exekutor som bockar av. `/compact` när context blir hög, dö aldrig mitt i. Stanna BARA vid verklig blockerare (secret bara Zivar har / live-DNS / pengar / Zivar-beslut). Ägar-steg → markera "väntar på Zivar", jobba vidare, loopa inte.

## Så här körs den här workflowen (LÄS FÖRST)
Det här är **ingen do-lista.** Varje fas körs i **lager med en subagent-flotta**, inte som ett rakt bygge:

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

**Poängen med flottan = förarbete och bredd.** På de viktiga delarna (rollgränser, migrationer, lojalitet, baseline, säkerhet) ska Code först låta flera agenter gräva i *parallella lager* — kod-lager, DB-lager, RLS-lager, flödes-lager, ops-lager — så planen vilar på det de hittat, inte på antaganden. En tunn agent som "bara bygger X" är fel; en flotta som först kartlägger X på djupet och SEDAN bygger är rätt.

## Mål
Ta hela Corevo Booking till en **fastställd, hållbar baseline**: ren FreshCut-demo med riktig data + salvia-tema, kunddomän-uppslag på plats, ALLA rollgränser bevisat täta, migrationerna rekoncilerade så tabellerna stödjer varje flöde (inkl. lojalitetspoäng), hela bygget mangelat i en djup robusthet-/säkerhetstest där varje sak som *kan* gå fel verifieras.

## Lägeskoppling
- HANDOFF: WORKFLOW-02 helsvep KLAR + LIVE (worker `a4b6e1d2`), vitest 138/138.
- Parkerat efter WF-02: goal-15 (freshcut-baseline) + goal-16 (custom-domains) — körs HÄR.
- Zivar-bugg (2026-06-02): super_admin → `/admin` landar på en salongs admin; `/personal`("frisör") nås utan att vara inloggad där. **Rollgräns håller inte.**

## Guardrails (ABSOLUTA — kör-läget upphäver dessa ALDRIG)
1. **POS orörd.** `corevo.se`/`admin`/`kiosk`/`superadmin`.corevo.se = annan produkt (Pages). Rör ALDRIG den zonens apex/POS-subdomäner. 200-koll före + efter varje deploy.
2. **Tenant-isolering = RLS + `private.tenant_id()`.** Frontend-filter är aldrig säkerhet. Rollgräns-fixen (VÅG 1) ligger OVANPÅ RLS, ersätter den inte.
3. **Ingen destruktiv DB utan PITR-tidpunkt + rollback-SQL i briefen** (VÅG 2 + VÅG 3).
4. **ASCII-byggväg** (`ö` kraschar OpenNext): `robocopy <5-Kod> C:\tmp\kod /E /PURGE /XD node_modules .next .open-next .git /XF .env.local` → `pnpm --dir C:\tmp\kod --filter @corevo/web run deploy`. `/PURGE` ALLTID.
5. **Live, inte localhost.** Varje fas verifieras i browser, alla berörda roller.
6. **Rollback-ankare vid deploy:** notera worker-ver före + `wrangler rollback <id> --config 5-Kod/apps/web/wrangler.jsonc`.

## Frozen files (rörs bara SOLO)
`middleware.ts`, `lib/supabase/middleware.ts`, `packages/auth/*`, `packages/db/*`, `supabase/migrations/*`, `lib/auth/roles.ts`, root-config (`wrangler.jsonc`, `next.config.ts`). VÅG 1, VÅG 2 och goal-16 rör frozen files → SOLO, sekventiellt, aldrig i parallell flotta. **Förarbets-flottan (recon) får dock läsa frozen files parallellt — den ändrar inget.**

---

## FAS 0 — Recon-flotta + plan-vs-kod (ingen kod ändras)
Spawna en **förarbets-flotta** (parallella läs-agenter, disjunkta revir). Varje agent → eget fynd-dok, väv ihop till **`2-Byggplan/FAS0-fynd-03.md`**.

**Recon-agenter (parallellt):**
- **A1 Rollgräns-lager:** läs `app/(admin)`, `(personal)`, `(platform)`, `(kund)`-layouter + `lib/auth/roles.ts` + middleware. Kartlägg var rollen kollas mot ytan (om alls). **Reproducera buggen live:** super_admin → `/admin` + `/personal` → vad händer, vilken tenant löses ut, läcker eller tomt? Klassa: UX-glitch eller åtkomsthål.
- **A2 Migrations-lager:** diffa molnet (clylvowtowbtotrahuad) mot `supabase/migrations/`. Verifiera: `0013` saknas (0012→0014), `0014_slot_holds` ej applicerad, goal-16:s "0011" krockar med kund-identiteten. Föreslå ren framåt-numrering.
- **A3 Flödes-vs-tabell-lager:** för varje flöde (skapa/byta/ändra/lägg till tenant·tjänst·personal·schema·branding; boka/avboka/omboka; **få poäng**; betala/refund; gäst) — finns tabell+RLS+RPC? Känt glapp: lojalitet-intjäning (0013) aldrig skriven → "få poäng" halvt.
- **A4 Skuld-/risk-lager:** verifiera (a) gäst-avboka `cancelByToken` refundar EJ (paritetsglugg); (b) övergiven `pending` låser slot. Leta fler tysta hål.
- **A5 RLS-/säkerhets-lager:** kör cross-tenant-sviten + advisor-skan som NULÄGE-baslinje (så VÅG 4 mäter mot den).

**Syntes:** dirigenten väger ihop A1–A5, fattar de öppna besluten (guard i middleware vs DAL; 0014 applicera nu eller dormant; numrering), skriver exakt bygg-plan per våg. Varje high-fynd adversariellt verifierat (reproducerat).

DoD FAS 0: `FAS0-fynd-03.md` klar, route-bugg reproducerad+klassad, migrations-sanning fast, flödes-glapp + skuld listade med åtgärds-våg.

---

## VÅG 1 — Rollgränser: ingen når fel yta (SOLO · frozen)
**Kronjuvelen.** Middleware kollar idag bara *inloggad-eller-inte* (rad ~100: "role-level authz stays in the DAL") och DAL-gränsen håller inte.

**Förarbete (flotta innan bygg):** A1:s karta + en agent som skriver rollmatris-test-spec (varje roll × varje yta → förväntat utfall) + en agent som kollar att en central guard inte bryter befintliga redirects (login-`next`, storefront-bounce). Bygg FÖRST när matris + spec är klara.

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
Playwright: logga in alla 4 roller, attackera varje cell i matrisen, bevisa redirect/neka. + vitest roll×yta. + RLS-cross-tenant 0 rader (ingen regress). Deploy + live + POS 200.
**Rollback:** `git revert` (rent tillägg, ingen schemändring).

---

## VÅG 2 — Migrations-rekoncil + lojalitet-intjäning (SOLO · frozen: db)

**Förarbete (flotta):** A2+A3 ger numrering + intjänings-kontrakt. En agent kartlägger var saldo LÄSES (M4 kundportal) så intjäningen matchar läsningen; en agent verifierar att pending-expiry inte krockar med M3-holds.

### Bygg
1. **Rekoncil numrering:** använd `0013` för lojalitet-intjäning, nästa lediga för domän (goal-16). Aldrig återanvänd nummer. Alla: additiva, `set search_path = public`, idempotenta, rollback för destruktivt.
2. **`0013` lojalitet-intjäning:** fyll `loyalty_ledger` när bokning blir `completed` (RPC/trigger, append-only, **idempotent per bokning** → omkörning dubblar ej). Härled saldo som förut. → "boka → få poäng" helt.
3. **`0014_slot_holds`:** applicera bara om hold/release wiras nu; annars dormant + dokumentera (safe).
4. **Skuld:** pending-expiry/slot-release (cron eller villkorad RPC) så aldrig-betald `pending` ej ockuperar tid för evigt.
5. Applicera mot molnet i transaktion, AFTER-verifiera, regenerera `packages/db/types.ts`.

### DoD
- [ ] Numrering ren, varje migration idempotent + rollback.
- [ ] `completed`-bokning → exakt en `loyalty_ledger`-rad; omkörning dubblar ej; saldo i portal stämmer.
- [ ] Pending-expiry bevisad. `db/types.ts` regenererad, typecheck grönt, 0 nya advisors.
**Rollback:** per migration (drop/revert-block i varje fil).

---

## VÅG 3 — Baseline: cleanup + FreshCut (goal-15) + kunddomän (goal-16)
Sekventiell. goal-16 rör `middleware.ts` (frozen) → SOLO efter VÅG 1.

**Förarbete (flotta):** en agent validerar Nördens freshcut-seed-data mot schemat (öre-priser, durations, staff_services-koppling); en agent torrkör raderings-transaktionen mot audit-guarden; en agent diffar `wrangler.jsonc routes` mot live så ingen domän detachas.

### 3a. Cleanup + goal-15 (FreshCut, riktig data)
- Innehåll: **`2-Byggplan/goals/freshcut-seed-data.md`** (Nörden skrapar freshcut.se). Saknad bild → salvia-default tills Zivar laddar upp.
- Kör goal-15: **PITR-tidpunkt först**, radera rent (disable audit-trigger i transaktion), seeda FreshCut-tenant (salvia-tema), 4 inloggningar (`Corevo2026!`), token-kolumner ALDRIG NULL, ingen bokningsdata. Inline-hex hålls borta (temat ska driva, ej maskeras).

### 3b. goal-16 (kunddomän-uppslag)
- Kör goal-16 med **rekoncilerat migrationsnummer** (ej "0011"). RPC `resolve_tenant_by_domain` (DEFINER, `search_path=''`, `verified=true`+`status=active`). Middleware: extern host + `unknown` → async uppslag + in-memory cache (positiv+negativ TTL). `wrangler routes` → live-domäner.
- DNS/cert för riktig kunddomän = **ops-steg Zivar** (goal-16 §OPS) → "väntar på Zivar".

### DoD
- [ ] Ren FreshCut-baseline, salvia live på freshcut.corevo.se, riktig data, 4 roller loggar in.
- [ ] `resolve_tenant_by_domain('<test>')` → rätt slug; okänd → null; cache slår ej DB/request.
- [ ] `wrangler` dry-run = ingen detach av freshcut/booking. POS 200.
- [ ] goal-15 + goal-16 → `_klart/`.
**Rollback:** DB → PITR; kod → revert.

---

## VÅG 4 — Djup robusthet + säkerhet (mangling)
Spawna en **adversariell test-flotta** (andra agenter än de som byggde). Mangla hela bygget. Verifiera VARJE fynd (reproducera). Bekräftade > råa. Säkerhetsfynd = aldrig polish.

### 4a. E2E-flotta — hela kedjan, alla 4 roller (live), en agent per roll-revir
- **super_admin:** skapa tenant + slug + tema + branding + ägare → faktureringsunderlag → suspend/återaktivera.
- **salon_admin:** ändra tjänster/priser, lägg till/ta bort personal, koppla tjänster, redigera schema (working_hours + explicit slots), byt branding (live preview), toggles, sök bokningar.
- **staff:** schema, dagens/incheckning, drop-in/walk-in, klientkort, frånvaro.
- **customer:** registrera, boka (V3 + snabb V4), **få poäng efter completed**, favoriter, omboka, avboka (inkl. gäst-token), Google-nudge.
- **betalning:** Stripe test-nycklar → boka m. betalning, refund vid avbokning, webhook-idempotens; annars "gatat på test-nycklar".

### 4b. Adversariell säkerhets-flotta (verifiera gränserna)
- **Rollgräns:** bryt varje cell i matrisen + främmande tenant. 0 hål.
- **Tenant-leak:** cross-tenant-svit (0 rader tvärs), PII-RPC:er anon → 42501.
- **Flödes-logik:** dubbelbokning (EXCLUDE), gapless kvitto/order-sekvens, **refund-paritet** gäst=kund/personal, no-show/refund, övergiven-pending släpper slot.
- **a11y/design:** 44px touch, kontrast, storefront läcker aldrig back-office-guld, back-office = UI-kit.
- **Secrets:** klientbundle utan server-secret-namn/`service_role`.

### 4c. Triage + fix
Blockerare (säkerhet/läcka/rollhål) FÖRST → logik → polish. Fixa bekräftade, re-verifiera, dokumentera nya anti-patterns. Allt grönt → deploy → live-smoke alla roller + POS 200.

### DoD
- [ ] Varje 4a-flöde körd live, alla roller, utan trasig väg (eller dokumenterat gatat).
- [ ] Rollmatris 0 brytbara celler. Cross-tenant 0 rader. PII-RPC anon-nekad.
- [ ] Bekräftade fynd fixade + re-verifierade; 0 öppna säkerhetsfynd.
- [ ] vitest + Playwright grönt; deploy; live-smoke; POS 200.

---

## FAS SLUT — fastställ, gå live + städa
1. Uppdatera **HANDOFF.md** (nuläge, worker-ver, rollback-ankare, ägar-steg).
2. **`2-Byggplan/TESTA-DETTA-03.md`** — testlista för Zivar inkl. rollmatris-checken han kan klämma själv.
3. **Gå live:** committa allt, **pusha till `main`**, och **deploya** (ASCII-byggväg, guardrail 4) så hela svepet är live. Notera ny worker-ver + rollback-ankare. Live-smoke alla roller + **POS 200**.
4. **Städa roten (obligatoriskt):** ALLT som är klart → rätt mapp enligt CLAUDE.md. goal-15 + goal-16 → `2-Byggplan/goals/_klart/`. FAS0-fynd-03 + WORKFLOW-03 kvar som logg i `2-Byggplan/`. `freshcut-seed-data.md` → `_klart/` med goalen. Ta bort tillfälliga filer. **Roten får BARA innehålla HANDOFF/CLAUDE + config + numrerade mappar.**
5. **Rent git-träd:** efter push ska `git status` vara **rent** (inga ostaged/oträckta filer kvar, inga halv-commits). Ändringsträdet ordnat = allt incheckat på `main`, arbetskopian ren.
6. Samla kvarvarande **ägar-steg** (Stripe test-nycklar, kunddomän-DNS väg A/B, SERVICE_ROLE_KEY om ej satt).

## Orkestreringsregler
- **Varje fas: förarbets-flotta (recon) → syntes → bygg → verifierings-flotta.** Inte en rak do-lista.
- Recon-agenter får läsa frozen files parallellt (ändrar inget). Bygg på frozen = SOLO.
- Bygg-flotta bara på disjunkta revir; en agent = en modul. Riktigt, inte stubbar; verifiera live.
- Verifierings-agenter ≠ bygg-agenter (adversariellt). Varje fynd reproducerat.
- `/compact` i tid. Vänta inte på Zivar utom verklig blockerare. Anti-loop på ägar-steg. Städa löpande.

## Slutlig DoD
Ren FreshCut-baseline live (salvia, riktig data) · kunddomän-uppslag klart · ALLA rollgränser bevisat täta · migrationer rekoncilerade + "få poäng" funkar · hela bygget mangelat med 0 öppna säkerhetsfynd · POS orörd · **pushat till `main` + deployat live** · HANDOFF + TESTA-DETTA-03 · goals i `_klart/`, **roten ren** · **`git status` rent**.
