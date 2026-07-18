# DIREKTION: Engagemangsmotorn (kund-identitet + kommunikation + rekommendationer)

> Strategisk riktning, inte en körplan. Fångar Zivars "sjuka galna tanke" om hur
> kund-admin ska funka, **grundad mot den faktiska databasen** (inte visionens
> idealnamn). De körklara stegen bor i plan 013–020. Denna fil håller helheten
> ihop så faserna inte driver isär.
>
> Planerad: 2026-07-17, mot commit `6cdd690`. Grund: två read-only-genomlysningar
> av schema + kod samma dag (identitet/kanaler + lojalitet/reko/behörighet).

## Visionen i en mening

Corevo ska automatiskt förstå **vilken kanal** kunden föredrar, **vad** kunden är
intresserad av, **när** kunden sannolikt vill boka igen, och **hur många** som ska
få samma erbjudande — så att salongen får fler återkommande bokningar och lägre
SMS-kostnad, och kunden en personlig upplevelse. Kunden börjar på SMS (utan konto),
flyttas över till konto + app, och får därefter push, klippkort och smarta
rekommendationer.

## ⚠️ Verklighetsankare — visionens namn ≠ databasens namn

Visionsdokumentet listar ~17 tabeller. Flera finns redan under **andra namn**, och
flera saknas helt. Bygg mot verkligheten, inte mot idealnamnen:

| Visionens namn | Verkligheten (2026-07-17) |
|---|---|
| `customer_profiles` | **`customers`** finns (migr 0011). `bookings.customer_id` är FK. `bookings.customer_profile_id` är en LEGACY plain uuid utan FK — förväxla inte. |
| `customer_accounts` | Ingen egen tabell. `customers.auth_user_id` (nullable) är kopplingen. **Men ingen claim/merge-kod finns.** |
| `bookings` | Finns. |
| `customer_preferences` | Delvis: `customers.preferences text[]` (fritext) + `customer_favorites` (personal ELLER tjänst). Klippintervall/kadens **saknas**. |
| `notification_preferences` | **Ingen tabell.** Bara tenant-nivå-toggles i `tenant_settings.settings.notifications` (läses) + per-personal-flaggor på `tenant_member_permissions` (skrivs men **läses aldrig** — död kontrakt). **Ingen per-kund-samtycke.** |
| `notification_events` / `notification_deliveries` | **Saknas.** Ingen leverans-/kostnadsledger. Enda durabiliteten = påminnelse-lease (`bookings.reminded_at` + claim-token, migr 0088). |
| `push_subscriptions` | **Saknas helt.** 0% push (ingen VAPID, ingen service worker). |
| `email_events` | Saknas som tabell. Mejl loggas non-PII till app-loggern. |
| `sms_messages` | Saknas. `lib/notifications/sms.ts` är en STUB (skickar aldrig — `skipped:transport_unavailable`). |
| `loyalty_cards` | `loyalty_ledger` finns (migr 0011, **earn-only**), `loyalty_plans`+`loyalty_members` (medlemskap, migr 0057). Balans/tier härleds (`sum(points_delta)`). Redeem/spend **saknas**. |
| `rewards` | Saknas (ingen förmånskatalog, ingen inlösen). |
| `referrals` | **Saknas helt.** |
| `recommendation_rules` / `recommendation_candidates` | **Saknas helt.** Reko-motor ~5% (bara råsignaler: favoriter + härlett senaste-besök + ett manuellt inaktiv-filter). |
| `campaigns` / `campaign_deliveries` | Saknas. `shop_orders.discount_cents` finns men oanvänd; `gift_cards` finns men INERT. Inga rabattkoder. |

**Klippkort/klass-pass:** finns bara som display-variant (`stamp_card`, migr 0035) —
ingen stämpel-/krediträknande tabell. **Rabattkoder, referral, presentkortsinlösen:
alla oimplementerade.** 3-tiers behörighet: rollstegen + grant-tabellen
(`tenant_member_permissions`, migr 0081) är solid, men marknadsförings-scope,
sändningstak och opt-out-skydd är 0%; per-personal data-scoping (frisör ser bara
sina kunder) saknas — all personal ser hela salongens kunder/bokningar.

## Löftesbärande arkitekturbeslut (Claudes mandat)

1. **Identitet är keystone. Byggs FÖRST (plan 013).** Utan en stabil, sammanslagen
   kund-identitet har samtycke, preferenser, klippkort och rekommendationer inget
   stabilt subjekt att hänga på. Idag blir samma människa 2–3 `customers`-rader
   (gäst-via-mejl, gäst-via-telefon, inloggad) utan merge-verktyg. Detta löses via
   claim-länk (magic-link kopplar inloggad auth-user till befintligt gästkort) +
   telefonbaserad dedup/verifiering. Schemat är redan byggt för det (surrogat-id,
   nullable `auth_user_id`, `contact_hash`) — bara koden saknas.

2. **`notifications_outbox` (leverans-ledger) är kommunikationens ryggrad.** Varje
   utskick blir ett rad-event: `{event_type, customer_id, chosen_channel,
   fallback_channel, consent_state, status, cost_öre, tenant_id, staff_id,
   provider_ref, created/sent/delivered_at}`. Det ger EN plats som vet varför ett
   meddelande skickades, vilken kanal som valdes, om kunden tackat nej, om det
   levererades, om det ska skickas igen, och vad det kostade. Detta är basen för
   allt: kanalrouting, anti-spam-frekvenstak, SMS-kostnadsdashboarden, och
   durabilitet (retry). Ersätter dagens fire-and-forget. Bygger PÅ plan 012:s
   pg_net/edge-dispatch — outboxen är tabellen webhooken/cronen läser.

3. **Kanalprioritet = push → e-post → SMS, men bara opt-in-kanaler.** Routern
   väljer billigaste aktiverade kanal. SMS skickas ALDRIG automatiskt till en kund
   som redan använder appen om de inte själva valt det. Detta är den ekonomiska
   tesen: varje kund som flyttar till konto+push sänker SMS-notan (se nedan).

4. **Service vs marknadsföring är HÅRT separerade i datamodellen.** Transaktionella
   meddelanden (boknings-/avbokningsbekräftelse, påminnelse, betalinfo) får alltid
   gå ut inom lag; marknadsföring (win-back, lediga tider, erbjudanden, referral)
   kräver eget opt-in och kan stängas av helt UTAN att slå av bekräftelser. Idag är
   receipts/cancellations hårdkodade "never-suppress" men separationen är
   tenant-nivå, inte per-kund. Per-kund-samtycke är ett GDPR-krav (samordna med
   plan 003 juridikpaketet).

5. **Reko + slot-fill = regelmotor + prioriterad, stegvis dispatch.** Ägaren sätter
   regler EN gång ("skicka till kunder som inte bokat på 6 v, högst 1×/30 dagar");
   Corevo räknar fram kandidater automatiskt. När en lucka uppstår: välj topp-N,
   skicka till de 3 högst prioriterade, reservera INTE tiden, släpp nästa grupp
   efter ~20 min om obokad, **stoppa alla utskick när tiden bokas**. Detta löser
   Zivars uttalade oro: samma lediga tid ska inte spammas till hundratals.

6. **Push kräver PWA. Egen pipeline (plan 015).** push_subscriptions + VAPID +
   service worker + "lägg till på hemskärmen". Push är billigast och bäst för
   appupplevelsen — men 0% byggt idag. Adoptions-spelet ("skapa konto får du
   digitalt klippkort + inga fler SMS") hänger på att push faktiskt funkar.

## Tre roll-scope (behörighetens nordstjärna)

Utökar goal-71:s `tenant_member_permissions`, river inte.

- **Ägare/salongsadmin (nivå 6):** sätter ramarna — tjänster, priser, klippkort,
  rabatter, mallar, vilka kampanjer som FÅR skickas, hur ofta kunder får
  marknadsföring, sändningstak, om personal får skapa egna kampanjer. Sätter regler
  en gång; Corevo kör automatiskt.
- **Frisör/personal (nivå 3):** ser sina bokningar/kunder, skapar personliga
  erbjudanden, ber systemet fylla en lucka, skickar godkänt erbjudande till utvalda
  — **inom ägarens gränser**. Kan ALDRIG kringgå en kunds opt-out eller skicka
  marknadsföring till någon som tackat nej. (Kräver nya scopes: `can_send_marketing`,
  sändningstak; opt-out-guarden bor i routern, inte i UI.)
- **Kund (nivå 2):** ser bokningar, av-/ombokar, ser klippkort/rabatter/erbjudanden,
  väljer kanal + meddelandetyper, anger klippintervall + favoritbehandlingar, väljer
  om den vill ha lediga tider/rekommendationer, hänvisar vän, hanterar konto.

## Anti-spam / stegvis dispatch (prioritetsmotorn)

Prioritetsordning för en ledig tid: (1) kundens vanliga frisör, (2) vanliga
behandling, (3) försenad enligt normalt intervall, (4) hög bokningssannolikhet,
(5) brukar boka samma tid, (6) inte nyligen fått erbjudande, (7) inte nyligen
avbokat/tackat nej. Dispatch: topp-N kandidater, skicka till 3 i taget, ~20 min
fönster, släpp nästa grupp om obokad, stoppa vid bokning, vänlig uppföljning till
den som klickade men inte hann. Frekvenstak per kund läses ur `notifications_outbox`
(punkt 2) — "högst 1 marknadsföring / 30 dagar" är en fråga mot ledgern, inte en
egen räknare.

## Kundens preferenser (fångas vid kontoskapande, hoppbara)

Klippintervall (varannan v / månad / 6–8 v / sällan), favoritbehandlingar,
vill-ha-rekommendationer (ja/ibland/nej), reko-frekvens, vill-ha-erbjudanden,
föredragen kanal. Hoppar kunden över → Corevo använder historik i stället. Lagras i
en riktig `customer_preferences`-tabell (klippintervall saknas i schemat idag; är
det som gör "due"-prediktorn möjlig utan gissning).

## SMS-kostnad: en övergångsmodell, inte en dag-ett-lösning

Freshcut ~2 250 SMS/mån × 0,52 kr = ~1 170 kr/mån. Flyttar Corevo över kunder till
push/e-post sjunker notan proportionellt (~25% ≈ −293 kr, 50% ≈ −585 kr, 75% ≈
−878 kr, 90% ≈ −1 053 kr). Därför: lös inte hela SMS-kostnaden direkt — bygg
övergången (varje konto = lägre nota) och **gör kostnaden synlig för ägaren**:
"42 återkommande kunder saknar konto — tillsammans 1 160 SMS senaste månaden."
Den siffran kommer ur `notifications_outbox` + `customers` (konto ja/nej).

## Fasordning (beroende-styrd)

| Fas | Mål | Bygger på | Nyckeltabeller | Plan |
|-----|-----|-----------|----------------|------|
| 1 | **Identitet** — claim/merge gäst↔konto + telefondedup | — | `customers` (finns), claim-token | **013** ✍️ |
| 2 | **Samtycke + kanalrouting + outbox** | 013, 006(SMS), 012(dispatch) | `customer_notification_prefs`, `notifications_outbox` | **014** ✍️ |
| 3 | **Push + PWA** | 013, PWA | `push_subscriptions` | **015** ✍️ |
| 4 | **Kundpreferenser** (kadens/intresse/kanalval) | 013, 014 | `customer_preferences` | 016 (scope nedan) |
| 5 | **Reko + slot-fill-motor** | 014, 016 | `recommendation_rules`, `recommendation_candidates` | 017 (scope) |
| 6 | **Lojalitet klar** — redeem + klippkort + referral + rabattkod | 013 | `rewards`, klippkort, `referrals`, kampanjkod | 018 (scope) |
| 7 | **3-tiers behörighet** — marknads-scope + tak + opt-out-guard | 014, goal-71 | utökar `tenant_member_permissions` | 019 (scope) |
| 8 | **Adoption + SMS-kostnadsdashboard** | 013,014,015 | läser outbox | 020 (scope) |

✍️ = full körklar plan skriven nu. Fas 4–8: scope nedan (skrivs som fulla planer
när 013/014 landat — detaljen beror på hur identitets- och outbox-lagret faktiskt
föll ut; att skriva dem nu vore gissning som ruttnar).

### Scope fas 4–8 (räcker för README + backlog, ej körklart än)

- **016 Kundpreferenser:** riktig `customer_preferences`-tabell (klippintervall,
  favoritbehandlingar, reko ja/ibland/nej, reko-frekvens, erbjudanden ja/nej,
  föredragen kanal). Frågeflöde vid kontoskapande (hoppbart). Fallback = historik.
  `customer_favorites` + `customers.preferences[]` finns redan — utöka, riv inte.
- **017 Reko/slot-fill-motor:** `recommendation_rules` (ägar-konfigurerade, med
  målgrupp/typ/kanal/maxfrekvens/giltighetstid/rabatt/vem-får-skapa/pausbar),
  `recommendation_candidates`, "due"-prediktor (intervall sedan senaste besök vs
  kundens kadens), stegvis dispatch (topp-N, 3-i-taget, 20-min-fönster,
  stopp-vid-bokning). Bygger på outboxen för frekvenstak. Bär win-back + rebook.
- **018 Lojalitet klar:** redeem-sidan av `loyalty_ledger` (negativa `points_delta`
  + `rewards`-katalog), klippkort/klass-pass (riktig kredit-decrement-tabell, inte
  bara display-variant), referral ("tipsa en vän" + kod + belöning), rabatt-/
  kampanjkoder (`shop_orders.discount_cents` finns oanvänd). Presentkort finns men
  INERT — koppla inlösen när betal-rälsen (plan 001) är grön.
- **019 3-tiers behörighet:** utöka `tenant_member_permissions` med
  `can_send_marketing` + sändningstak; opt-out-guard i routern (personal kan inte
  skicka marknadsföring till opt-out-kund). Ev. per-personal data-scoping
  (`can_view_all_calendars` finns som intent, ej backat av RLS). ⚠️ Samordna med
  Codex goal-71 — kör inte parallellt mot samma filer (se plan 010).
- **020 Adoption + SMS-kostnad:** konto-CTA i SMS-bekräftelsen (claim-länk från
  013), PWA-install-prompt, referral-incitament, och ägar-dashboard "N kunder saknar
  konto = M SMS/mån" (läser outbox + `customers`). Gör SMS-kostnaden synlig →
  personalen får anledning att hjälpa kunder till appen.

## Tvärgående risker (bär in i planerna)

- **Duplikat-kort-skuld:** samma människa = flera `customers`-rader idag. Plan 013
  MÅSTE inkludera en merge-väg (inte anta greenfield) — annars ärver reko/klippkort
  fel subjekt.
- **GDPR-radering:** `lib/gdpr/erase.ts` scrubbar `customers`, men 0011-headern
  varnar för att erase måste nå ny PII. Varje ny kund-PII-tabell (prefs, outbox,
  push_subscriptions) måste in i erase-vägen. Samordna med plan 003 + 007.
- **Samtycke = juridik:** per-kund marknadssamtycke hör ihop med plan 003
  (integritetspolicy/samtycke). Bygg inte marknadskanalen utan samtyckesposten.
- **Free→Pro:** DB är PRO nu (backup/PITR) — outbox + push_subscriptions kan växa;
  övervaka storlek (Workers 3 MiB-taket gäller fortfarande bundlen, inte DB).

## Relaterade dokument

- `plans/DIREKTION-super-kaka.md` — bredare konkurrensstrategi (HR/Planday, POS,
  global kundportal). Engagemangsmotorn är kund-CRM-delen av den kakan.
- `plans/010` — behörighetsmatris (goal-71-följd), samordningspunkt för fas 7.
- `plans/012` — durabel dispatch-infra (pg_cron + pg_net + edge). Fas 2 bygger på den.
- `plans/006` — SMS via 46elks (provider-fetch). Fas 2 kanalrouting kräver den.
- `plans/003` — juridikpaketet (samtycke). Fas 2 + 7 kräver samtyckesposten.
