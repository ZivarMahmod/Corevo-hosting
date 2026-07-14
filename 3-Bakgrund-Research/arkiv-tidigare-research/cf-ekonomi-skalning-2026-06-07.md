# 💰 Cloudflare Ekonomi-skola för Corevo — 2026-06-07

**Kurs använd: 1 USD = 9,50 SEK** (USD/SEK ~9,38–9,46 första veckan juni 2026).
Alla priser verifierade 2026-06-07 mot Cloudflares egna docs/pricing-sidor. TL;DR: **Cloudflare är i praktiken gratis för Corevo upp till 40+ kunder. Hela infra-kostnaden = 48 kr/mån (Workers Paid).**

---

## 1. 🧮 VAD ÄR EN REQUEST?

En "request" = ett anrop som **träffar Worker-koden** (din Next.js-server). Viktigast av allt:
**Statiska filer (JS, CSS, fonter, byggda bilder) är GRATIS och OBEGRÄNSADE** — de räknas aldrig, ens på free plan. Bara SSR-sidor och API-anrop räknas.

| Händelse | Worker-requests (räknas) | Statiska (gratis) |
|---|---|---|
| 1 sidladdning (SSR-HTML + 2–4 data-anrop) | **~3–6** | 20–50 filer |
| 1 bokning (flöde: tider → personal → bekräfta) | **~10–20** | — |
| 34 personer surfar (5 sidor var) | **~700–1000 totalt** | — |
| 100 personer bokar samtidigt | **~1500–2000 på några minuter** | — |

**Klarar free plan 100 samtidiga bokningar?** Ja, kapacitetsmässigt — Workers skalar automatiskt och har **ingen gräns på requests/sekund**, bara dagstaket 100 000/dag. 2000 requests är 2 % av en dags free-kvot. Den verkliga free-risken är CPU-taket (se §2).
Källa: [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) · [Static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

---

## 2. 🆓 FREE PLAN I VERKLIGHETEN

| Tjänst | Free-gräns | Vad händer vid taket |
|---|---|---|
| Workers requests | **100 000/dag** (nollställs midnatt UTC) | **Error 1027** mot kunden ("rate limited") ELLER Workern förbikopplas — du väljer "fail open/closed" per route. **Aldrig en faktura.** |
| Workers CPU-tid | **10 ms/request** ⚠️ | **Error 1102** mot kunden. SSR (Next.js) drar typiskt 10–20 ms → **free plan är på gränsen för Corevos arkitektur** |
| Subrequests | 50/request (fetch + Supabase-anrop) | Request misslyckas |
| Custom domains (Worker) | **100 per zon** (= max ~100 tenant-subdomäner; sen wildcard-route) | Kan inte lägga till fler |
| R2 | 10 GB lagring, 1M skrivningar (A), 10M läsningar (B)/mån | Fel vid skrivning utan betalkort |
| CF for SaaS hostnames | **100 gratis**, sen **$0,10 ≈ 0,95 kr/st/mån** | Faktura (kräver betalkort) |
| DNS | Gratis, obegränsade frågor, 1000 records/zon | — |
| SSL (Universal + SaaS-certs) | **Gratis**, auto-förnyas | — |

**Kärnan:** free-gränserna ger **fel mot kund**, inte faktura. Det är därför Workers Paid (48 kr) är obligatorisk affärsförsäkring — den tar bort både 1027-risken och höjer CPU-taket från 10 ms till 30 sek.
Källa: [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) · [SaaS Plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/) · [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

---

## 3. 📈 PAID-TRAPPAN (Workers Paid — $5 ≈ 48 kr/mån)

| | Ingår i 48 kr/mån | Överskott (rörligt) |
|---|---|---|
| Requests | **10 miljoner/mån** | $0,30/M ≈ **2,85 kr per extra miljon** |
| CPU-tid | 30 miljoner ms/mån | $0,02/M ms ≈ 0,19 kr |
| Inga dagstak | requests obegränsade | — |
| CPU per request | 30 sek (höjbart till 5 min) | — |

**Fast vs rörligt:** 48 kr/mån är FAST minimum. Rörligt tillkommer BARA om du passerar 10M requests/mån — det är ~65 gånger mer trafik än 40 salonger genererar. Du kan sätta **budget-alerts** i dashboarden så du varnas långt innan.
Källa: [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

---

## 4. 🧾 KOSTNADSKALKYL PER KUND (kurs 9,50)

Antaget per salong/mån: 2000 sidvisningar (×5 req) + 150 bokningar (×15 req) + admin-användning ≈ **~20 000 Worker-requests**, 100 MB R2.

| Salonger | Req/mån | % av Paid-taket (10M) | R2 totalt | Plan | **CF-kostnad/mån** | **Kostnad per kund** | Intäkt (1200 kr/kund) |
|---|---|---|---|---|---|---|---|
| 3 | 60 000 | 0,6 % | 0,3 GB | Free går (rek. Paid) | **0–48 kr** | 0–16 kr | 3 600 kr |
| 6 | 120 000 | 1,2 % | 0,6 GB | Paid | **48 kr** | 8 kr | 7 200 kr |
| 10 | 200 000 | 2 % | 1 GB | Paid | **48 kr** | 4,80 kr | 12 000 kr |
| 20 | 400 000 | 4 % | 2 GB | Paid | **48 kr** | 2,40 kr | 24 000 kr |
| 40 | 800 000 | 8 % | 4 GB | Paid | **48 kr** | 1,20 kr | 48 000 kr |

R2 ligger under free-tiern (10 GB) ända till ~100 salonger; därefter 0,14 kr/GB/mån. Custom hostnames gratis upp till 100 kunder med egen domän.
**Slutsats: CF-kostnaden är platt 48 kr/mån genom hela resan 1→40 kunder = 0,1 % av intäkten vid 40 kunder. Regeln "aldrig högre infra än intäkt" är ohotbar på Cloudflare-sidan — det som växer är Supabase (separat kalkyl).**
Källa: [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [R2 Pricing](https://developers.cloudflare.com/r2/pricing/) · [SaaS Plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/)

---

## 5. 🌐 DOMÄNER & NS — vem äger vad

Tre olika roller som ofta blandas ihop:
- **Registrar** = butiken där domänen KÖPS och förnyas (Miss Hosting för corevo.se). Äger kundrelationen mot .se-registret (Internetstiftelsen).
- **DNS-host** = den som SVARAR när någon frågar "vart pekar corevo.se?". Behöver inte vara samma bolag som registraren.
- **NS-poster** = skylten som säger vilken DNS-host som gäller. För att Workers custom domains på *.corevo.se ska fungera **måste NS peka på Cloudflare** (typ `xxx.ns.cloudflare.com`) — kolla med `nslookup -type=NS corevo.se`. Domänen kan ändå bo kvar (ägas/betalas) hos Miss Hosting.

**Cloudflare Registrar:** säljer domäner till självkostnadspris (0 % påslag, t.ex. .com = $10,46 ≈ 99 kr/år) — **MEN stöder INTE .se** (finns ej bland deras ~350 TLD:er). corevo.se måste alltså stanna hos en svensk registrar (Miss Hosting, eller flytt till t.ex. Loopia/one.com, ~150–300 kr/år). Det är helt OK — registrar och DNS är separata.

**Kunders egna domäner — rätt modell (= den Corevo redan kör):** kunden köper och äger sin domän hos valfri registrar (~150 kr/år för .se), och CNAME:ar till Corevo. CF for SaaS utfärdar SSL automatiskt. Kunden betalar sin egen domän → Corevo har 0 kr kostnad (under 100 hostnames) och inga juridiska knas om kunden lämnar. **Köp aldrig kundens domän åt dem** — då äger du deras varumärke.

**NS4.SIMPLY.COM** = Simply.com:s (danskt hostingbolag) namnservrar. Tusentals kunddomäner pekar dit för att Simply är deras DNS-host. Corevos motsvarighet ("ns1.corevo.se") heter **Custom Nameservers** hos Cloudflare — kräver **Business-plan ($200 ≈ 1 900 kr/mån)**. Inte värt det nu; CNAME-modellen ger samma resultat för 0 kr. Återbesök vid 100+ kunder.
Källa: [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) · [CF Registrar prislista (saknar .se)](https://cfdomainpricing.com/) · [Custom hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/)

---

## 6. 📊 METRICS-ORDLISTA (dashboarden)

| Term | Betyder | Zivar kollar varje vecka? |
|---|---|---|
| **Requests** | Anrop som träffade Workern | ✅ JA — trenden + avstånd till 10M |
| **Subrequests** | Anrop Workern själv gör ut (Supabase, R2, mejl) | Nej, bara vid felsökning (tak 1000→10 000) |
| **CPU time** | Tid CPU:n RÄKNAR (väntan på Supabase räknas EJ). Snitt-Worker: 2,2 ms; SSR: 10–20 ms | ✅ JA — median + p99 |
| **Duration / wall time** | Total klocktid inkl. väntan. Påverkar inte fakturan på Paid | Nej |
| **Errors / Invocation statuses** | Kraschar: `exceededCpu` (1102), `error`, `exceededMemory` | ✅ JA — ska vara ~0 |
| **Bandwidth / egress** | Datautflöde. **R2 = $0 egress, alltid.** Workers har inga trafikavgifter | Nej — kostar aldrig något |
| **KV reads / R2 Class A+B** | Läs/skriv-operationer mot lagring | Nej, under free-tier länge |

**Veckorutinen (2 min):** Workers & Pages → Metrics: (1) Requests-trend, (2) Errors = 0?, (3) CPU p99 < 50 ms?
Källa: [Workers Limits/CPU](https://developers.cloudflare.com/workers/platform/limits/#cpu-time) · [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

---

## 7. 🔭 HUR VET JAG ATT WORKERS GÖR SITT JOBB?

| Verktyg | Free | Paid | Vad det ger |
|---|---|---|---|
| **Workers Logs** (inbyggt) | ~200k händelser/dag, 3 dgr historik | 20M/mån, 7 dgr, sen $0,60/M | Se varje request + console.log + fel i dashboarden |
| **Logpush** (skicka loggar externt) | ❌ | ✅ ingår | Behövs inte än |
| **Notifications/alerts** (mejl) | ✅ gratis | ✅ | Budget-alerts + Passive Origin Monitoring |
| **Health Checks** (CF pingar dig) | ❌ (kräver Pro-zon, $25 ≈ 238 kr/mån) | ❌ | Skippa — extern pinger är gratis |

**Konkret rekommendation (totalkostnad 0 kr extra):**
1. **UptimeRobot (gratis, 50 monitorer, 5 min-intervall)** — pinga `corevo.se`, en tenant-subdomän och ett bokning-API-endpoint. Mejl/push när nere. Detta är svaret på "hur vet jag" — en oberoende robot som testar som en kund.
2. Slå på **budget/usage-alerts** i CF-dashboarden (finns numera i varje produkts sidebar).
3. Veckotitt enligt §6.
Källa: [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) · [Health Checks](https://developers.cloudflare.com/health-checks/) · [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

---

## 8. 🧰 OANVÄNT SOM COREVO BORDE ÖVERVÄGA

| Tjänst | Kostnad | Relevans för boknings-SaaS |
|---|---|---|
| **Cron Triggers** | Gratis (5 st free / 250 Paid; körningar räknas som requests) | ✅ Används redan (reminders). Lägg till: städjobb, statistik-aggregering |
| **KV** (nyckel-värde-cache) | Free: 100k läs/dag · Paid: 10M läs/mån, sen $0,50/M | ⭐ HÖG — cacha tenant-branding/feature-toggles → färre Supabase-anrop, snabbare sidor |
| **Queues** (jobbkö) | Kräver Paid; 1M ops/mån ingår, sen $0,40/M | ⭐ HÖG vid shop — mejlutskick, Stripe-webhooks, bildjobb körs i bakgrunden utan att blockera bokningen |
| **D1** (SQL-databas) | Free: 5M radläsningar/dag | ❌ Nej — Supabase är databasen. Två databaser = dubbelt strul |
| **Durable Objects** | Ingår i Paid (SQLite-DO även free) | 🟡 Senare — realtidskalender, dubbelboknings-lås |
| **Email Routing** | Gratis | 🟡 Ta EMOT mejl på @corevo.se och vidarebefordra (skick går via one.com idag) |
| **Analytics Engine** | Ingår i Workers Paid (10M datapunkter/mån) | 🟡 Per-salong-statistik utan att belasta Supabase |
| **Rate Limiting** | 1 regel gratis per zon | ⭐ Sätt på boknings-API:t → stoppar bots innan de bränner requests |
| **Cache/CDN** | Gratis | ✅ Får du redan automatiskt på statiska filer |

**När shoppen kommer:** bilderna växer (100 GB R2 = 14 kr/mån — fortfarande fickpengar), betalningarna går via Stripe (deras avgift ~1,5–2,9 %, inte en CF-kostnad), trafiken kan 10-dubblas och ändå rymmas i 10M-taket. Det enda CF-nya som behövs är Queues (ingår i Paid).
Källa: [Workers Pricing (alla produkter)](https://developers.cloudflare.com/workers/platform/pricing/) · [Queues Pricing](https://developers.cloudflare.com/queues/platform/pricing/) · [KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)

---

## 9. 🛡️ REDUNDANS — kunden får aldrig se en fattig sida

**Ingår gratis, alltid:** Cloudflares globala nät (330+ städer, anycast — närmaste datacenter svarar), **obegränsat DDoS-skydd**, Universal SSL, statiska filer serveras från edge även under tung last. Workern har ingen "server som kan dö" — den kör överallt samtidigt.

**Vad som faktiskt kan göra sidan fattig, i sannolikhetsordning:**
1. **Free-planens tak** (1027/1102-fel) → löses permanent med Workers Paid, 48 kr. Största enskilda risken idag.
2. **Supabase nere/pausad** → Cloudflare hjälper inte; databasen är den verkliga single-point-of-failure. Åtgärd: try/catch i Workern som visar en snygg statisk "vi är strax tillbaka, ring salongen på 07X..."-sida (statiska assets funkar även när API:t inte gör det) i stället för en kryptisk felsida.
3. **Deploy-miss** → Workers har versioner + omedelbar rollback i dashboarden (gratis).
4. **Du vet inte om att det är nere** → extern pinger enligt §7.

Mer än så (multi-region-databas, load balancing $5+/mån) är överkurs före ~100 kunder.
Källa: [Cloudflare Plans](https://www.cloudflare.com/plans/) · [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)

---

*Research utförd 2026-06-07. Alla priser från developers.cloudflare.com / cloudflare.com/plans. Kurs 9,50 SEK/USD.*
