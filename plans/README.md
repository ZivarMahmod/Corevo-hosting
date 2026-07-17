# Implementation Plans

Genererade av improve-skillen 2026-07-16/17 mot commit `6cdd690`. Tre rundor:
- **Runda 1** (systemgenomlysning): plan 001–005.
- **Runda 2** (djupare jakt på Zivars begäran — spara/ta-bort-luckor, säkerhet överallt,
  tidsbaserad robusthet, SMS-detalj, research-svep, konkurrensanalys): plan 006–009 +
  `DIREKTION-super-kaka.md`. 8 read-only agenter, alla fynd vettade mot koden.
- **Runda 3** (prestanda/infra + engagemangsmotorn): plan 011–015 +
  `DIREKTION-engagemangsmotor.md`. 011/012 = felt långsamhet + durabel infra.
  013–015 = Zivars kund-admin-vision (identitet → samtycke/kanalrouting → push),
  grundad mot faktiskt schema (visionens tabellnamn ≠ verklighetens — se DIREKTION).

Backloggen är GitHub — dessa filer är körklara underlag. Se "Publicering" nederst om
de ska bli GitHub-issues.

## Exekveringsordning & status

| Plan | Titel | Prio | Effort | Beror på | Status |
|------|-------|------|--------|----------|--------|
| 001  | Betal-/notisräls-buggar (PayPal-presentkort, reservationssvep, påminnelse-CAS) | P1 | S | — | DONE (Codex-sweep `9d47424`: leverans+prune+atomic claims 0088) |
| 002  | Säkerhetshärdning runda 1 (anon-inserts, CSS-sink, cookieflaggor, loggscrub) | P1 | M | — | DONE (sweep 0084+sinks; rester `2691bfb`: cookies+värde-scrub) |
| 003  | Juridikpaketet (villkor, integritetspolicy, samtycke, ångerrätt, org-nr/moms) | P1 | L | — | DONE `7ff5709` — JURIDIK-TEXT = platshållare (operatör granskar); admin-skrivfält deferrade tills goal-71-acceptans |
| 009  | Säkerhet runda 2 (open redirect, boknings-backstop, SVG, R2-utkast, rate-limit) | P1→P3 | M | mjuk: 008 | DONE (sweep: redirect/SVG/fail-closed/0085; `2691bfb`: shop+avboka-limits). R2-utkast = ops-dokumenterad rest |
| 004  | Självservice-lösenordsåterställning (alla tre dörrar) | P2 | M | — | DONE (sweep: glomt-losenord + aterstall-losenord + ops-doc) |
| 006  | SMS via 46elks (provider-fetch, E.164, avsändar-ID, opt-out) | P2 | M | — | DONE `df4720d` — vilande tills `wrangler secret put SMS_46ELKS_*` |
| 007  | UX/CRUD-luckor (kontaktinkorg, GDPR-radera, skapa kund, window.confirm) | P2 | M | — | DONE `7a7710b` |
| 008  | Tidsrobusthet (prune-svep, retention, Node 22, Stripe-pin, DB-testdatum) | P2 | M | mjuk: 001,005 | DONE (sweep + `2691bfb`: 0089-retention+pin). site_revisions-cap = BLOCKED produktbeslut (0080-triggern) |
| 010  | Behörighetsmatris + falska UI-kontrakt (Codex-fynd, goal-71-följd) | P1 | M | — | DONE `ca2ad9c` |
| 011  | Admin/sajt-prestanda — döda auth-round-trips (getClaims) | P1 | M | — | DONE (signing keys var redan aktiva: ECC P-256) — rök efter deploy: ingen utloggningsloop |
| 012  | Durabel infra — pg_cron + DB-webhooks → edge functions | P1 | L | mjuk: 005,006 | HALV: pg_cron-migr 0090 KLAR `2691bfb` (parallellt m. GH tills job_run_details grönt); webhook/edge-halvan = post-launch (ponytail-cut) |
| 005  | Driftgrind (post-deploy-smoke + härdad cron) | P2 | M | ersätts delvis av 012 | DONE (sweep: smoke+dispatch+migrationsgrind; CF-Triggers-utredning REJECTED — pg_cron vann) |

### Engagemangsmotorn (kund-CRM/kommunikation) — se `DIREKTION-engagemangsmotor.md`

Beroende-styrd fasordning. 013–015 = fulla planer; 016–020 scope:ade i DIREKTION
(skrivs som fulla planer när 013/014 landat — detaljen beror på utfallet).

| Plan | Titel | Prio | Effort | Beror på | Status |
|------|-------|------|--------|----------|--------|
| 013  | **Identitets-keystone — claim/merge gäst↔konto + telefondedup** | P1 | L | — | TODO |
| 014  | **Kommunikationsryggrad — samtycke + kanalrouting + notifications_outbox** | P1 | L | 013, 006, 012; mjuk 003 | TODO |
| 015  | **Push-pipeline + PWA** | P2 | L | 013, 014 | TODO |
| 016  | Kundpreferenser (kadens/intresse/kanalval) — *scope i DIREKTION* | P2 | M | 013, 014 | PLANERAD |
| 017  | Reko + slot-fill-motor (regler, due-prediktor, stegvis dispatch) — *scope* | P2 | L | 014, 016 | PLANERAD |
| 018  | Lojalitet klar (redeem + klippkort + referral + rabattkod) — *scope* | P2 | L | 013 | PLANERAD |
| 019  | 3-tiers behörighet (marknads-scope + tak + opt-out-guard) — *scope* | P2 | M | 014, goal-71 | PLANERAD |
| 020  | Adoption + SMS-kostnadsdashboard — *scope* | P3 | M | 013,014,015 | PLANERAD |

Status: TODO | IN PROGRESS | DONE | BLOCKED (en rad varför) | REJECTED (en rad varför) | PLANERAD (scope finns, ej körklar plan än)

Rekommenderad ordning för LANSERING: 001 → 002 → 009 (open redirect först i 009) →
003 → 004/006/007/008/005 parallellt. Strategisk riktning bortom lansering:
`DIREKTION-super-kaka.md`.

## Beroenden & kollisionsvarningar

- **Cron-området**: 001 lägger `prune_expired_shop_reserves` i pending-expiry-rutten,
  008 lägger `prune_expired_slot_holds` på SAMMA ställe, 005 rör `cron-booking.yml`
  (workflow). Kör inte parallellt mot samma fil.
- **Migrationsnummer**: 0081/0082 är TAGNA av goal-71 (tenant_member_permissions,
  byggt efter planrundorna). 002 tar 0083, 003 + 008 + 009 tar nästa lediga — synka.
- **Plan 010 + 019** rör samma behörighetsområde som Codex bygger (goal-71) — samordna,
  kör inte parallellt mot samma filer.
- **Engagemangsmotorn (013–020)** grundar sig på FAKTISKT schema, inte visionens
  idealnamn (`customers` ≠ `customer_profiles`, ingen `notification_preferences`-tabell
  finns, push 0%). Läs verklighetsankaret i `DIREKTION-engagemangsmotor.md` FÖRST — annars
  byggs mot fantasitabeller.
- **013 är keystone**: 014/015/016/017/018/020 refererar alla `customers.id` som stabilt
  subjekt. Landa 013 (claim/merge) innan de andra, annars ärver de fel/duplicerat subjekt.
- **014-outboxen** är enda sanningskällan för utskick — 017 (frekvenstak), 020 (SMS-kostnad)
  och 012 (retry) läser den. Lägg aldrig en parallell räknare.
- **Migrationsnummer**: 0088 var högsta 2026-07-17. 013/014/015 tar var sin (>=0089) —
  synka med 002/003/008/009 som också tar nummer.
- **CRON constant-time**: bor i 008 steg 5; 009 dubblerar inte (SÄK-07).
- **Codex arbetar i `4-Dokument-Underlag/.../Dagens genomgångar/04-*` och `05-*`** —
  dessa planer rör INTE de mapparna.

## Nästa våg (identifierade, ej planerade — värdeordnat)

**Snabbvinster (dagar):**
1. Aktivera den DORMANTA no-show-avgiften — logiken finns (`lib/booking/no-show-refund.ts`,
   "future/when Zivar activates"), bara ej kopplad till charge.
2. Rapportexport CSV/PDF — `lib/admin/stats.ts` räknar allt, renderar bara i UI.
3. Flerstegs-påminnelser (24h + 2h) — `reminders.ts` kör enkelt schema.
4. Ägar-redigerbart lojalitetsprogram — `LojalitetAdmin.tsx` är read-only, skriv-actions
   bara på plattformssidan (`lib/platform/actions/loyalty.ts`).
5. Städa döda "Kommer snart"-toggeln "Drop-in synligt" (`components/admin/SettingsForm.tsx:202`).
6. Öppettider ⇄ publik bokbar tid — `lib/admin/actions.ts:844` säger redigering "does
   NOT yet change the public bookable times" (latent förvirringsbugg).

**Medelstora (moduler, säljbara):**
7. ~~Väntelista~~ → **plan 017** (slot-fill-motorn bär väntelista/notis-vid-lucka).
8. Återkommande kundbokningar ("var 4:e vecka") — närliggande 016/017.
9. ~~Klippkort/paket + rabatt-/kampanjkoder~~ → **plan 018**.
10. ~~Automation-regelmotor~~ → **plan 017** (reko/slot-fill = första automation-motorn; Smoobu-mönstret).
11. RLS-regression + readonly-E2E i CI — `supabase/tests/*.sql` (1614 rader) körs aldrig.
12. Stripe-webhook route-tester + rate-limit (435 rader otestat pengaflöde).
13. ~~Lätt kommunikationsledger/outbox~~ → **plan 014** (`notifications_outbox` = ryggraden).

**Stora spår (strategiska):**
14. Mini-Planday inbakat: tidsstämpling → tidrapport → löneunderlag/SIE-export
    (största HR-gapet mot Planday/Crona).
15. Global kundportal / "Mina Företag"-hub (Zivars vision) — kommunikationsledger +
    host-routing först; arkitekturbesluten redan tagna i researchen.
16. Kundimport (CSV: kunder + framtida bokningar) — onboarding-blockerare vid byte från
    Bokadirekt/Treatwell.
17. SaaS-fakturering Corevo→tenant (Stripe Billing) + DPA-mall.
18. Fysisk POS/kassa.

## Övervakas, ej kodfix nu (frysta/externa invarianter)

- **3 MiB Workers-tak**: bundlen slog redan i taket 2026-07-14 (3.17 MiB gz), räddad av
  minify. Nästa feature kan fälla deployen ("Script too large"). Övervaka bundle-storlek.
- **Supabase Free 7-dagars-paus + cron-keepalive**: cron-pingen håller ovetande DB vaken;
  tystnar cronen (60-dagarsregeln) OCH ingen trafik i 7 dagar → total paus. Verifiera plan/backup.
- **`@supabase/ssr` 0.10.3-pin + 400-dygns cookie**: sessionslivslängden bor i Supabase
  Dashboard, ej kod — dokumenteras i plan 008 steg 7.
- **Legacy Supabase JWT-nycklar** (anon/service_role): exp ~2036, men nyckeltypen fasas
  ut → framtida tvingad rotation.

## Findings considered and rejected

- **Next.js 15 → 16** (DEPS-02): vänta på `@opennextjs/cloudflare`-stöd för Next 16.
- **`html-react-parser` oanvänt** (DEPS-01): en rad i package.json — gör i förbifarten.
- **Gratis kursanmälan överbokning** (CORRECTNESS-04): medvetet accepterad, dokumenterad i kod.
- **Stripe-refund frigör ej kursplats** (CORRECTNESS-05): LOW confidence — investigate om kurs skarpt.
- **`get_public_booking` utan token-gate** (SECURITY-04 r1): UUID + ingen PII — medvetet beslut.
- **`select('*')`-svepet** (PERF-03): mest cachat; gör `location-context.ts` i förbifarten.
- **Dubbel `getUser()`** (PERF-01): kräver Supabase-nyckelbeslut; efter lansering.
- **Hard-delete av platser/roller/branscher/tenants/ordrar/bokningar** (UX-agent 6,7,8, m.fl.):
  medvetet soft-delete/"build-once-never-delete" — bekräftade produktbeslut, ej buggar.
- **Domän/personal-schema read-only i admin**: sannolikt avsiktliga ops-/admin-gates —
  bekräfta med Zivar, ej fix utan beslut.
- **`compatibility_date`-pin**: korrekt Workers-mönster, inte en bomb (bara periodisk översyn).

## Publicering till GitHub

Dessa planer är INTE publicerade som issues. Plan 002 + 009 beskriver
säkerhetssårbarheter (open redirect, XSS-sink, rate-limit) — om repot är publikt får de
INTE publiceras öppet utan att först göras privata. Fråga Zivar om repo-synlighet +
bekräftelse innan `--issues`-publicering; säkerhetsplanerna hålls annars lokala.
