# 🎓 Supabase-skolan — ekonomi & skalning för Corevo (2026-06-07)

Allt verifierat 2026-06-07 mot supabase.com/pricing + docs. Valutakurs antagen: **1 USD ≈ 9,5 SEK**.
Corevos läge: Pro-plan (~$25/mån ≈ 240 kr), Cloudflare Workers framför, R2 för bilder.

---

## 1. 💳 Vad ger Pro-planen ($25/mån)?

| Del | Ingår i Pro | Överskott kostar |
|---|---|---|
| Disk (databas) | **8 GB** per projekt | $0.125 per GB/mån |
| Compute | **$10/mån i krediter** = 1 st Micro-instans (2-core ARM, 1 GB RAM) gratis | Större instans = mellanskillnaden (se §4) |
| Connections (Micro) | **60 direkta / 200 via pooler** | Höjs bara genom större compute |
| Auth MAU | **100 000** aktiva användare/mån | $0.00325 per MAU |
| Realtime samtidiga | **500** peak-anslutningar | $10 per 1 000 |
| Realtime messages | **5 miljoner/mån** | $2.50 per miljon |
| Egress (bandwidth) | **250 GB** (+250 GB cachad) | $0.09/GB ($0.03 cachad) |
| Fil-storage | **100 GB** | $0.0213 per GB |
| Edge Functions | **2 M anrop/mån** | $2 per miljon |
| Backups | Dagliga, **7 dagars** historik — ingår | — |
| PITR (point-in-time) | **Ingår INTE** | **$100/mån per 7 dagars retention** |
| Loggar | 7 dagars retention | Log drain: $60/drain/projekt |
| Branching | Ingår ej i baspriset | $0.01344 per branch/timme (~1 kr/h) |

**Viktigt:** "Spend cap" är PÅ som standard på Pro — då stannar tjänsten vid taken i stället för att fakturera extra. Stäng av den när riktiga kunder är beroende av drift (annars är det taket = driftstopp). Utan spend cap höjs Realtime-taken dessutom till 10 000 anslutningar / 2 500 msg/s.

Källa: [supabase.com/pricing](https://supabase.com/pricing)

---

## 2. 📦 "1 GB used" — vad räknas egentligen?

Dashboarden visar tre staplar (Settings → Compute and Disk → Disk size distribution):

| Kategori | Vad det är |
|---|---|
| **Database** | Din riktiga data: tabeller, index, materialiserade vyer |
| **WAL** | Write-Ahead Log — Postgres "ändringsdagbok". Växer med skrivtryck, rensas automatiskt |
| **System** | Reserverat av Supabase, litet, kan inte påverkas |

Två fällor:
- **Raderade rader frigör inte plats direkt** — Postgres markerar dem som döda tills `vacuum` körs (sker automatiskt). `npx supabase inspect db bloat --linked` visar svullnad.
- **Disken krymper aldrig automatiskt** — växer den till 9 GB och du rensar till 2 GB betalar du ändå för 9 GB tills du begär nedskalning via support.

**Är 1 GB mycket? Räkneexempel för Corevo:**

| Post | Ungefärlig storlek |
|---|---|
| 1 bokningsrad (uuid:er, tider, status, notering) | ~400 bytes + ~200 B index |
| Status-historik (3–4 rader à ~150 B) | ~600 bytes |
| 1 audit-rad (JSONB före/efter) | ~800 bytes |
| **Totalt per bokning** | **~2–3 KB** |

40 salonger × 150 bokningar/mån = 6 000 bokningar/mån ≈ **18 MB/mån = ~220 MB/år**.
**8 GB rymmer alltså grovt 30+ års bokningar för 40 salonger.** Databasen blir ALDRIG Corevos första flaskhals — 1 GB är jättemycket för bokningsdata. Det som äter plats är loggar/audit utan rensning och bilder i databasen (gör aldrig det — bilder hör hemma i R2).

Källa: [Database size-guiden](https://supabase.com/docs/guides/platform/database-size)

---

## 3. 🖼️ Storage: Supabase Storage vs Cloudflare R2

**Enkelt uttryckt:** Databasen = bokningar/text/siffror. Storage/R2 = filer (bilder, PDF). Två olika lådor.

| | Supabase Storage (Pro) | Cloudflare R2 (Corevos val) |
|---|---|---|
| Lagring ingår | 100 GB, sen $0.0213/GB | 10 GB gratis, sen $0.015/GB |
| **Egress (nedladdning)** | Räknas mot 250 GB-potten, sen **$0.09/GB** | **$0 — alltid gratis** |
| Operationer | Ingår | Class A $4.50/M, Class B $0.36/M (generös free tier) |
| RLS-koppling till auth | Ja, inbyggt | Nej — egen logik i Workern |

**R2 är rätt val för Corevo.** Salongbilder/logotyper visas på publika bokningssidor = många nedladdningar = egress är kostnadsdrivaren, och R2:s egress är noll. Dessutom bor Corevo redan på Cloudflare (samma nät, ingen extra latens).
**Supabase Storage vore bättre** bara om filerna behövde per-användare-behörighet via RLS (t.ex. privata kunddokument) — då slipper man bygga egen åtkomstkontroll.

Källor: [supabase.com/pricing](https://supabase.com/pricing) · [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

---

## 4. 🪜 Compute-trappan — när och varför uppgradera?

| Storlek | Pris/mån (netto efter $10-kredit) | RAM | Direkt / Pooler-connections | Disk-baseline |
|---|---|---|---|---|
| **Micro** (nu) | $10 → **$0** | 1 GB | 60 / 200 | 11 MB/s, 500 IOPS |
| Small | $15 → **$5 (~50 kr)** | 2 GB | 90 / 400 | 22 MB/s |
| Medium | $60 → **$50 (~475 kr)** | 4 GB | 120 / 600 | 43 MB/s |
| Large | $110 → **$100 (~950 kr)** | 8 GB | 160 / 800 | 79 MB/s |
| XL | $210 (4-core) | 16 GB | 240 / 1 000 | 149 MB/s |

**Symptom att hålla koll på (i den ordningen de brukar dyka upp):**
1. **Connection errors** ("remaining connection slots reserved" / pooler-timeouts) → pooler-taket nått
2. **Disk IO % consumed > 1 %** i Observability → IO-budgeten bränns, queries blir slöa i skov
3. **CPU/RAM konstant > 70–80 %** → allmänt seg, Realtime tappar anslutningar
4. **Slow queries** i Query Performance som inte beror på saknade index

**För Corevo:** 150 bokningar + 2 000 sidvisningar/salong/mån är *lite* last. 40 salonger ≈ 80 000 sidvisningar/mån ≈ 2 700/dag — Micro klarar det datamässigt med marginal. Det som knäcker Micro först är **inte** trafiken utan **antal samtidiga anslutningar** (200 i poolern) eftersom Workers öppnar många korta. Med korrekt transaction-mode-pooling (§5) räcker Micro sannolikt till **30–50 salonger**; planera Small runt ~30 salonger som billig försäkring (~50 kr/mån extra).

Källa: [Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)

---

## 5. 🔪 Knivvassa funktioner Corevo inte använder (än)

| Funktion | Vad den gör | För Corevo |
|---|---|---|
| **Supavisor transaction mode** (port 6543) | Connection-pooler: tusentals korta klienter delar 60 DB-connections | **KRITISK NU — se nedan** |
| **pg_cron** | Schemalagda SQL-jobb i databasen | **NU**: påminnelse-mejl, rensa gamla audit-rader, no-show-städning — gratis, ingen extra infra |
| **pg_net / Database Webhooks** | Tabelländring → HTTP-anrop automatiskt | **NU/SNART**: ny bokning → POST till Workern som mejlar. Robustare än app-logik |
| **pg_stat_statements** | Topplista över dyraste queries | **NU**: redan aktiv — titta i Query Performance varje vecka |
| **Branching** | Klonad test-databas per feature (~1 kr/h) | **SNART**: testa migrationer utan att röra produktion |
| **Edge Functions** | Serverless-funktioner hos Supabase (2 M anrop ingår) | Senare — Workers täcker behovet; bra för DB-nära jobb |
| **Log drains** | Skicka loggar till externt verktyg ($60/mån) | Senare |
| **Read replicas** | Läs-kopia av databasen (egen compute, täcks EJ av krediter) | Långt senare — 100+ salonger/rapporttunga kunder |
| **pgvector** | AI-embeddings/semantisk sökning | Ej relevant nu |

### ⚠️ Varför pooler-läget är kritiskt med Workers
Cloudflare Workers = hundratals korta, parallella processer som var och en vill ha en egen DB-anslutning. Micro har bara **60 direkta** — direktanslutningar tar slut OMEDELBART under last. **Supavisor i transaction mode (port 6543)** lånar ut en anslutning bara under själva transaktionen och lämnar tillbaka den → 200 klienter delar poolen utan problem.

**Corevo bör verifiera:**
1. Går all DB-trafik via `supabase-js` (HTTP/PostgREST)? → Då är det redan OK, PostgREST poolar själv.
2. Finns NÅGON direkt Postgres-anslutning från Workers (Prisma/postgres.js/Drizzle)? → Den MÅSTE peka på port **6543** (transaction mode), aldrig 5432.
3. I transaction mode fungerar inte `prepared statements`/sessionsvariabler — relevant om `private.tenant_id()` sätts via session config; verifiera att RLS-uppsättningen är transaction-säker.
4. Pooler-storlek: max ~40 % av max connections till poolen om PostgREST används tungt (Supabases egen tumregel).

Källa: [Connection management](https://supabase.com/docs/guides/database/connection-management)

---

## 6. 🟢 Uptime mot kund

- **Status-sida:** [status.supabase.com](https://status.supabase.com) — prenumerera på mejlnotiser.
- **SLA:** Pro har **INGET SLA**. 99,9 %-åtagandet gäller **endast Enterprise**. Pro får "best effort" + e-postsupport. ([supabase.com/sla](https://supabase.com/sla))
- **Bygg eget förtroende i tre steg:**
  1. **Health-endpoint** i Workern: `/api/health` gör en mini-query (`select 1`) → svarar OK/FAIL.
  2. **Extern monitor** (UptimeRobot/BetterStack, gratisnivå räcker) pingar health-endpointen varannan minut och larmar Zivar via mejl.
  3. **Egen statussida** (BetterStack/Instatus gratis) → länka från Corevo-admin: "Driftstatus". Kunden ser grönt = lugn.

---

## 7. 🔍 Svårt att hitta i dashboarden — "titta här varje vecka"

| Var | Vad du letar efter |
|---|---|
| **Advisors** (Database → Advisors) | Säkerhetshål (RLS av!), saknade index — Supabase säger det GRATIS, läs det |
| **Query Performance** (Database → Query Performance) | Topp-5 dyraste queries; ny query i toppen = nåt nytt är fel |
| **Observability/Reports → Database** | Connection-grafen (närmar den sig 200?), CPU, RAM |
| **Disk IO % consumed** (samma rapport) | > 1 % = IO-budgeten används; nära 100 % = uppgradera compute |
| **Logs Explorer** (Logs → varje tjänst) | Postgres-, PostgREST-, Auth-loggar bor HÄR, inte i Workers-loggarna |
| **Settings → Compute and Disk** | Disk size distribution: Database vs WAL vs System |
| **Auth → Rate Limits** | Vad mejl-taken faktiskt står på (se §8) |

---

## 8. 🚦 API-tak FÖRE databasen — vad slår man i först?

| Tak | Gräns | Hur det märks |
|---|---|---|
| **Auth-mejl (inbyggd SMTP)** | **2 mejl/timme!** | Signup/återställning "kommer inte fram". **Corevo kör egen SMTP (one.com) = taket gäller inte, ni sätter eget.** Verifiera värdet under Auth → Rate Limits |
| Auth OTP/magic links | 30/h, 60 s mellan per användare | "Vänta innan du försöker igen" |
| Auth övriga endpoints | Token bucket, ~30 burst per IP | `429 Too Many Requests` |
| Realtime | 500 samtidiga, 500 msg/s, 100 kanaler/anslutning (Pro m. spend cap) | Klienter tappar prenumerationer, `too_many_joins` i loggen |
| PostgREST (API-anrop) | **Obegränsat antal anrop** — taket är compute/connections, inte ett antal | Slöhet/timeouts, aldrig 429 från PostgREST självt |

**Ordningen Corevo slår i tak:** 1) Auth-mejlflöden (om egen SMTP strular) → 2) pooler-connections vid trafikspik → 3) Realtime samtidiga (först vid ~250+ samtidigt inloggade admins = långt bort).

Källor: [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) · [Realtime limits](https://supabase.com/docs/guides/realtime/quotas)

---

## 9. 📈 Uppskalnings-triggers + kostnadsprognos

| Trigger | Åtgärd |
|---|---|
| ~30 salonger ELLER connection-fel i loggen | Uppgradera Micro → Small (+~50 kr/mån) |
| Disk IO % consumed > 5 % återkommande | Compute ett steg upp (IO-budget följer storleken) |
| Första betalande kund som är driftkänslig | Stäng av spend cap + skaffa extern monitor (§6) |
| ~20 salonger / riktiga pengar i systemet | Överväg PITR ($100/mån ≈ 950 kr) — dyrt, men 7-dagars dagliga backups ingår redan; PITR = sista timmen räddas också |
| 100+ salonger / tunga rapporter | Medium/Large + ev. read replica |

**Prognos (Supabase-delen, spend cap av, ingen PITR; kurs 9,5):**

| Salonger | Bokn./mån | Compute | Supabase-kostnad/mån |
|---|---|---|---|
| 3 | 450 | Micro (ingår) | $25 ≈ **240 kr** |
| 6 | 900 | Micro | $25 ≈ **240 kr** |
| 10 | 1 500 | Micro | $25 ≈ **240 kr** |
| 20 | 3 000 | Micro | $25 ≈ **240 kr** |
| 40 | 6 000 | Small (försäkring) | $30 ≈ **285 kr** |

Med PITR tillkommer ~950 kr/mån. Egress, MAU, Realtime och disk ligger alla på låga ensiffriga procent av Pro-taken även vid 40 salonger — **Supabase-räkningen är i praktiken platt till långt över 40 kunder.**

Källa: [supabase.com/pricing](https://supabase.com/pricing)

---

## 🧾 Sammanfattning (10 rader)

1. Pro ($25 ≈ 240 kr/mån) ger 8 GB disk, gratis Micro-instans, 100k MAU, 500 Realtime-anslutningar, 250 GB egress, 7 dagars backups.
2. 8 GB databas rymmer 30+ års bokningar för 40 salonger (~2–3 KB/bokning) — datamängden blir aldrig problemet.
3. Första flaskhalsen är **connections från Workers** — verifiera att ev. direkta DB-anslutningar går via Supavisor port 6543 (transaction mode).
4. Andra flaskhalsen: Auth-mejlflöden — inbyggd SMTP tillåter bara 2 mejl/h, Corevos egna one.com-SMTP kringgår det (verifiera taket i dashboarden).
5. R2 för bilder är RÄTT val: noll egress-kostnad mot Supabases $0.09/GB.
6. Kostnad vid 40 kunder: ~285 kr/mån (Small-compute), +950 kr/mån om PITR läggs till.
7. Viktigaste oanvända funktionen: **pg_cron** (påminnelser/städjobb gratis i databasen) + Database Webhooks för bokningsmejl.
8. Pro har INGET SLA — bygg health-endpoint + gratis extern monitor + statussida för kundförtroende.
9. Veckorutin: Advisors, Query Performance, connection-grafen, Disk IO % consumed.
10. Spend cap: stäng av den innan betalande kunder är beroende — annars är budgettaket = driftstopp.
