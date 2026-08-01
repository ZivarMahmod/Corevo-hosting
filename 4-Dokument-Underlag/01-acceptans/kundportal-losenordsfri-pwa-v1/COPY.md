# COPY.md — All svensk UI-text (del 1 av 3)

**Produkt:** Kundportal, lösenordsfri PWA v1 (Corevo)
**Status:** BINDANDE. Varje rad är exakt text — inga alternativformuleringar, inga synonymer vid implementation.
**Överordnad lag:** `4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md`. Där briefen låser en exakt sträng gäller briefens sträng; vid konflikt mellan denna fil och briefen vinner briefen (README §Överordnad lag).
**Omfattning del 1:** Corevo-skal/topbar, navigation, TenantIdentityCard, startsidan `/mina` (en/flera/inga kommande), alla statuslabels, historik, bokningsdetalj (inkl. spärrad avbokning och ägarskaps-404), avbokningsdialog, kalenderexport, Boka igen, boknings-PIN steg 4 (alla tillstånd) och tenant-hostat steg 5 (alla tillstånd).
**Del 2 och 3** täcker: bootstrap/länklägen, återhämtning + verifiering, profil, kontaktbyte, säkerhet/enheter, PWA-installation, tomlägen/fel/skelett på skalnivå.

## Placeholder-konventioner

| Placeholder | Betydelse | Exempel (fixture) |
|---|---|---|
| `[Företag]` | Tenantens namn ur sessionens tenant-kontext | FreshCut |
| `[maskerad destination]` | Maskerat mobilnummer eller maskerad e-postadress | `•••• •• 45 67`, `z•••@g•••.com` |
| `[datum]` | Lokalt datum, t.ex. "tors 23 jul 2026" | — |
| `[tid]` | Lokalt klockslag/intervall, t.ex. "14:30–15:15" | — |
| `[tjänst]` | Tjänstens namn | Klippning |
| `[nummer]` | Företagets publika telefonnummer | — |
| `[n]` | Heltal (försök, sekunder, minuter) | — |
| `[00:ss]` | Nedräkning minuter:sekunder | 00:27 |

Nivåer: `heading` (h1/h2/etikett med rubrikroll), `body` (brödtext), `button` (knapptext), `link` (länktext), `label` (formulär-/fältetikett), `meta` (metarad/hjälptext), `chip` (statuschip), `error` (feltext), `aria` (aria-label/tillgängligt namn, ej synlig), `live` (annonseras via `aria-live`/`role="status"`/`role="alert"`), `title` (dokumenttitel).

---

## 1. Corevo-skal och topbar

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-SHELL-01 | Skip-länk, första fokuserbara elementet | link | Hoppa till innehåll | §20; COMPONENTS §1 |
| CP-TOP-01 | Topbar, Corevo-identitet vänster | heading | COREVO | §4/§7; COMPONENTS §2 |
| CP-TOP-02 | Topbar, monoetikett under/bredvid logotypen | meta | MINA BOKNINGAR | §7; COMPONENTS §2 |
| CP-TOP-03 | Topbar mobil/tablet, profilknapp höger | aria | Öppna profil | §7.1; COMPONENTS §2 |
| CP-TOP-04 | Topbar, detaljläge (ersätter profilknappen) | button | Tillbaka | §12 Tillbakakontrakt; COMPONENTS §2 |
| CP-TOP-05 | Topbar desktop, utloggningsåtgärd höger | button | Logga ut | §7.3; COMPONENTS §2 |
| CP-SHELL-02 | Dokumenttitel, alla portalsidor (mönster) | title | [Sidnamn] – [Företag] | §20; COMPONENTS §1 |

## 2. Navigation (bottennav / vänsternav)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-NAV-01 | `<nav>` tillgängligt namn | aria | Huvudmeny | §7; COMPONENTS §3 |
| CP-NAV-02 | Navpost 1 → `/mina` | link | Bokningar | §7; COMPONENTS §3 |
| CP-NAV-03 | Navpost 2 → `/mina/historik` | link | Historik | §7; COMPONENTS §3 |
| CP-NAV-04 | Navpost 3 → `/mina/profil` | link | Profil | §7; COMPONENTS §3 |

Aktiv post bär `aria-current="page"` — ingen extra text; färg är aldrig enda signalen (§20).

## 3. TenantIdentityCard (företagshuvud)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-TID-01 | Företagsnamn (h1 på `/mina`) | heading | [Företag] | §10.1; COMPONENTS §5 |
| CP-TID-02 | Branschetikett (endast om data finns), t.ex. | meta | Frisörsalong | §10.1; COMPONENTS §5 |
| CP-TID-03 | Telefonåtgärd, riktig `tel:`-länk | link | Ring | §10.1 |
| CP-TID-04 | Kartåtgärd, endast om adress/kartlänk finns | link | Hitta hit | §10.1 |
| CP-TID-05 | Adressrad (endast om data finns) | body | [gatuadress], [ort] | §10.1; COMPONENTS §5 |
| CP-TID-06 | Bokningsursprung, metarad | meta | Du bokade via [företagets webbadress] | COMPONENTS §5 |
| CP-TID-07 | Logotypfallback: initialplatta (logotypbild har `alt=""`, namnet bär informationen) | aria | (tom alt — ingen text) | §10.1; COMPONENTS §5 |

Saknat optionalfält (logotyp, telefon, adress, ursprung) → raden utgår helt; ingen platshållartext (COMPONENTS §5).

## 4. Startsidan `/mina`

### 4.1 En kommande bokning (hero-kortet)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-HOME-01 | Kortets etikett | heading | NÄSTA BOKNING | §10.2 |
| CP-HOME-02 | Datum + tid (mono) | body | [veckodag] [datum] · [tid] | §10.2 |
| CP-HOME-03 | Tjänst + längd (längd endast om känd) | body | [tjänst] · [n] min | §10.2 |
| CP-HOME-04 | Personalrad när personal är satt | body | [personalens namn] | §10.2 |
| CP-HOME-05 | Personalrad när ingen personal valts | body | Valfri personal | §10.2 |
| CP-HOME-06 | Plats/adress (från bokningen) | body | [platsnamn], [gatuadress] | §10.2 |
| CP-HOME-07 | Pris endast om lagrat — aldrig fabricerat | body | [pris] kr | §10.2 |
| CP-HOME-08 | Primär CTA | button | Visa bokningen | §10.2 |
| CP-HOME-09 | Sekundär CTA (kalender) | button | Lägg i kalender | §10.2/§14 |
| CP-HOME-10 | Diskret destruktiv textknapp, endast när onlineavbokning är tillåten | button | Avboka | §10.2 |
| CP-HOME-11 | Boka igen-knapp under kommande bokningar | button | Boka en tid till | §10.3 |

### 4.2 Flera kommande bokningar

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-HOME-12 | Rubrik över den kompakta listan (bokning 2 och framåt) | heading | Fler kommande | §10.2 |
| CP-HOME-13 | Listrad (länk till detalj) | link | [veckodag] [datum] · [tid] — [tjänst] | §10.2; COMPONENTS §7 |

### 4.3 Ingen kommande bokning (tomläge)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-HOME-14 | Tomlägesrubrik | heading | Ingen kommande bokning | §10.5 |
| CP-HOME-15 | Tomlägestext när historik finns | body | Du har ingen bokning på gång just nu. | §10.5 |
| CP-HOME-16 | Tomlägestext när historik saknas | body | Du har inga bokningar hos [Företag] ännu. | §10.5 |
| CP-HOME-17 | Primär CTA i tomläget | button | Boka ny tid | §10.5/§10.3 |
| CP-HOME-18 | Boka igen-rad (senaste genomförda, endast om tjänsten fortfarande är publik) | button | Boka igen | §10.5 |
| CP-HOME-19 | Metarad under Boka igen-raden | meta | Senast: [tjänst], [datum] | §10.5 |

### 4.4 Fel- och laddläge på startsidan

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-HOME-20 | Bokningskortet, hämtningsfel | error | Bokningarna kunde inte hämtas. Din bokning är oförändrad. | §19; COMPONENTS §6 |
| CP-HOME-21 | Sekundär knapp vid hämtningsfel | button | Försök igen | COMPONENTS §6 |
| CP-HOME-22 | Samma knapp under omförsök (`aria-disabled`) | button | Hämtar… | COMPONENTS §6 |

### 4.5 Statuslabels (kanonisk, sluten matris — enda tillåtna)

| COPY-ID | Runtime-status | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-STATUS-01 | `pending`, start i framtiden | chip | Förfrågan mottagen | §11.1 |
| CP-STATUS-02 | `confirmed`, start i framtiden | chip | Bekräftad | §11.1 |
| CP-STATUS-03 | `completed` | chip | Genomförd | §11.1 |
| CP-STATUS-04 | `cancelled` | chip | Avbokad | §11.1 |
| CP-STATUS-05 | `no_show` | chip | Uteblev | §11.1 |
| CP-STATUS-06 | `pending`/`confirmed`, start passerad utan avslut | chip | Väntar på avslut | §11.1 |
| CP-STATUS-07 | okänd status (neutral fallback) | chip | Status uppdateras | §11.1 |

Texten bär alltid statusen; färg är aldrig enda bärare (§20). Andra labels = FAIL.

## 5. Historik `/mina/historik`

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-HIST-01 | Sidrubrik | heading | Historik | §11; COMPONENTS §8 |
| CP-HIST-02 | Sektion 1 (`completed`) | heading | Tidigare besök | §11 |
| CP-HIST-03 | Sektion 2 (`cancelled`) | heading | Avbokade bokningar | §11 |
| CP-HIST-04 | Sektion 3 (`no_show`, väntande utfall, okänd) | heading | Övriga bokningar | §11 |
| CP-HIST-05 | Listrad (länk till detalj) | link | [tjänst] — [datum] | §11 |
| CP-HIST-06 | Tomläge | body | Du har inga tidigare bokningar hos [Företag] ännu. | §11 |
| CP-HIST-07 | Pagineringsknapp efter 20 rader | button | Visa fler | §11; COMPONENTS §8 |
| CP-HIST-08 | Pagineringsknapp under hämtning (`aria-disabled`) | button | Hämtar… | §11; COMPONENTS §8 |
| CP-HIST-09 | Fel vid "Visa fler" (toast/inline, `role="alert"`) | error/live | Fler bokningar kunde inte hämtas. Försök igen. | §18 Historik "fel vid fler"; §19 |
| CP-HIST-10 | Fel vid första hämtningen | error | Historiken kunde inte hämtas. | COMPONENTS §8 |
| CP-HIST-11 | Sekundär knapp vid fel | button | Försök igen | COMPONENTS §8 |

## 6. Bokningsdetalj `/mina/bokningar/[id]`

### 6.1 Normal vy

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-DET-01 | Synlig tillbaka-åtgärd (mål enligt ursprung; fallback `/mina`) | button | Tillbaka | §12 Tillbakakontrakt |
| CP-DET-02 | Dokumenttitel | title | Bokning – [Företag] | §20; COMPONENTS §10 |
| CP-DET-03 | Datum + tid (h1, mono) | heading | [veckodag] [datum] · [tid] | §12 |
| CP-DET-04 | Kartlänk (extern, `rel="noopener"`) | link | Öppna i karta | §12; COMPONENTS §10 |
| CP-DET-05 | Kundens bokningsmeddelande, delkortets etikett (endast om kundsynligt meddelande finns) | label | Meddelande | §12; COMPONENTS §10 |
| CP-DET-06 | Policyblockets etikett | label | Avbokningsvillkor | §12 |
| CP-DET-07 | Exakt sista kostnadsfria tidpunkt | body | Kostnadsfri avbokning till [datum] [tid]. | §12 |
| CP-DET-08 | Action: kalender | button | Lägg i kalender | §12/§14 |
| CP-DET-09 | Action: boka igen (aktiv bokning) | button | Boka en tid till | §12 |
| CP-DET-10 | Action: avboka (endast när tillåtet) | button | Avboka bokningen | §12 |
| CP-DET-11 | Action: boka igen (historisk bokning, endast om tjänsten är publik) | button | Boka igen | §12 |

Saknat optionalfält (personal, telefon, karta, pris, meddelande, policy) → raden utgår helt (COMPONENTS §10).

### 6.2 Spärrad avbokning (blocked-cancel)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-DET-12 | Spärrad + publik telefon finns | body | Den här bokningen kan inte längre avbokas online. Ring [Företag] på [nummer]. | §12 |
| CP-DET-13 | Telefonnumret i CP-DET-12 är en riktig `tel:`-länk | link | [nummer] | §12 |
| CP-DET-14 | Spärrad + publik telefon saknas | body | Den här bokningen kan inte längre avbokas online. Kontakta [Företag] via deras webbplats. | §12 |
| CP-DET-15 | Orden "deras webbplats" i CP-DET-14 är en fungerande publik kontaktlänk | link | deras webbplats | §12 |

### 6.3 Fel och ägarskaps-404

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-DET-16 | Hämtningsfel (nätverk/server) | error | Bokningen kunde inte hämtas. Din bokning är oförändrad. | §19; COMPONENTS §10 |
| CP-DET-17 | Sekundär knapp vid hämtningsfel | button | Försök igen | COMPONENTS §10 |
| CP-DET-18 | Ägarskaps-404: felaktigt id, annan kunds bokning eller fel tenant — EXAKT samma neutrala text för alla tre fallen | body | Bokningen kunde inte visas | §12; §19 (neutralt säkerhetsfel) |
| CP-DET-19 | Tillbaka-åtgärd på 404-ytan (mål `/mina`) | button | Tillbaka | §12; COMPONENTS §10 |

## 7. Avbokningsdialog

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-CAN-01 | Dialogrubrik (`aria-labelledby`) | heading | Avboka bokningen? | §13 |
| CP-CAN-02 | Sammanfattning (`aria-describedby`) | body | [veckodag] [datum] · [tid] — [tjänst] hos [Företag] | §13 |
| CP-CAN-03 | Policyrad (exakt policytext ur bokningen, om villkor finns) | body | [policytext] | §13 |
| CP-CAN-04 | Sekundär knapp | button | Behåll bokningen | §13 |
| CP-CAN-05 | Destruktiv knapp | button | Ja, avboka | §13 |
| CP-CAN-06 | Stängknappens tillgängliga namn | aria | Stäng | §13 |
| CP-CAN-07 | Pending: destruktiv knapp låst (`aria-disabled`), dubbelinskick omöjligt | button | Avbokar… | §13 |
| CP-CAN-08 | Success: dialog stängs, chip → "Avbokad", bekräftelse (`role="status"`) | live | Bokningen är avbokad. [Företag] har fått besked. | §13 |
| CP-CAN-09 | Nätverks-/serverfel: dialogen ligger kvar, inlinefel (`role="alert"`) | error/live | Avbokningen kunde inte genomföras. Din bokning är oförändrad. | §13; §19 |
| CP-CAN-10 | Knapp vid nätverks-/serverfel | button | Försök igen | §13 |
| CP-CAN-11 | Policy ändrad under dialogen: ingen mutation görs, ny policystatus visas (`role="alert"`) | error/live | Bokningen kan inte längre avbokas online. Din bokning är oförändrad. | §13; §19 |
| CP-CAN-12 | Kvarvarande knapp vid policy ändrad ("Ja, avboka" döljs) | button | Stäng | §13; COMPONENTS §11 |
| CP-CAN-13 | Redan avbokad (idempotent): behandlas som lyckat — samma stängning, chip och bekräftelse som CP-CAN-08, aldrig ett fel | live | Bokningen är avbokad. [Företag] har fått besked. | §13 |

## 8. Kalenderexport

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-CAL-01 | Knapp, default (aldrig "Hämta kalender-länk") | button | Lägg i kalender | §14 |
| CP-CAL-02 | Pending (`aria-disabled`) | button | Hämtar… | COMPONENTS §12 |
| CP-CAL-03 | Lyckad hämtning, diskret statusrad (`role="status"`) | live | Kalenderfilen är klar | §14 |
| CP-CAL-04 | Fel, statusrad (`role="alert"`) | error/live | Kalenderfilen kunde inte skapas. Försök igen. | §14 |

Ägarskapsfel ger exakt samma text som CP-CAL-04 — ingen skillnad som avslöjar om bokningen existerar (COMPONENTS §12; §19).

## 9. Boka igen (sluten labellista)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-AGAIN-01 | Aktiv bokning finns (`/mina`, detalj, steg 5) | link | Boka en tid till | §10.3 |
| CP-AGAIN-02 | Ingen aktiv bokning (`/mina` tomläge) | link | Boka ny tid | §10.3/§10.5 |
| CP-AGAIN-03 | Historik/historisk detalj, tjänsten fortfarande publik | link | Boka igen | §11/§12 |

Målet är alltid tenantens faktiska publika `/boka`-URL; saknas den renderas knappen inte (COMPONENTS §13). Inga andra labels är tillåtna.

## 10. Boknings-PIN — steg 4 av 5 (tenanthosten)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-PIN-01 | Formulärrubrik | heading | Ange koden | §9.1; COMPONENTS §14 |
| CP-PIN-02 | Kodfältets etikett (ETT semantiskt fält, `one-time-code`) | label | Engångskod | §9.1; COMPONENTS §14 |
| CP-PIN-03 | `sending`: kanalrad, fält + primärknapp låsta (`aria-live="polite"`) | live | Skickar koden… | §9.1 sending; COMPONENTS §14 |
| CP-PIN-04 | `sent` (SMS): kanalrad (`aria-live="polite"`) | live | Vi har skickat en kod via SMS till [maskerad destination] | §9.1 sent; COMPONENTS §14 |
| CP-PIN-05 | `sent` (SMS): ändra-åtgärd | button | Ändra mobilnummer | §9.1 sent |
| CP-PIN-06 | `sent` (e-post): kanalrad (`aria-live="polite"`) | live | Vi har skickat en kod via e-post till [maskerad destination] | §9.1 sent; COMPONENTS §14 |
| CP-PIN-07 | `sent` (e-post): ändra-åtgärd | button | Ändra e-post | §9.1 sent |
| CP-PIN-08 | Primär knapp | button | Verifiera | COMPONENTS §14 |
| CP-PIN-09 | Verifiera pending (`aria-disabled`, fält låst) | button | Verifierar… | COMPONENTS §14 |
| CP-PIN-10 | `invalid`: inlinefel med kvarvarande försök (`role="alert"`), fokus åter till kodfältet, värdet kvar | error/live | Fel kod. Du har [n] försök kvar. | §9.1 invalid |
| CP-PIN-11 | `cooldown`: omskickskontrollen inaktiv, nedräkning (`aria-live="polite"`, ingen fokusstöld) | live | Skicka ny kod om [00:ss] | §9.1 cooldown |
| CP-PIN-12 | `resend_ready`: omskicksknapp (ny kod ogiltigförklarar gammal) | button | Skicka ny kod | §9.1 resend_ready |
| CP-PIN-13 | Efter omskick: bekräftelse i kanalraden (`aria-live="polite"`) | live | En ny kod har skickats. | §9.1; COMPONENTS §14 resend |
| CP-PIN-14 | `expired`: felrad (`role="alert"`), Verifiera låst tills ny kod begärts | error/live | Koden har gått ut. Begär en ny kod. | §9.1 expired; COMPONENTS §14 |
| CP-PIN-15 | `max_attempts`: challenge låst, fält + Verifiera låsta, ingen bokning (`role="alert"`) | error/live | För många försök. Begär en ny kod om [n] min. | §9.1 max_attempts; COMPONENTS §14 |
| CP-PIN-16 | `delivery_failed` (SMS): kanalriktig felrad (`role="alert"`), omskick aktivt utom under cooldown | error/live | SMS:et med koden kunde inte skickas. Försök igen eller ändra mobilnummer. | §9.1 delivery_failed; §19 |
| CP-PIN-17 | `delivery_failed` (e-post): kanalriktig felrad (`role="alert"`) | error/live | Mejlet med koden kunde inte skickas. Försök igen eller ändra e-post. | §9.1 delivery_failed; §19 |
| CP-PIN-18 | `slot_lost`: ersättningsyta, ingen kodinmatning kvar | body | Tiden hann tyvärr bokas av någon annan. | §9.1 slot_lost; COMPONENTS §14 |
| CP-PIN-19 | `slot_lost`: primär knapp tillbaka till lediga tider | button | Välj en ny tid | §9.1 slot_lost; COMPONENTS §14 |
| CP-PIN-20 | `verified`: kort bekräftelse (bock + text), automatisk vidaregång till steg 5 (`role="status"`) | live | Verifierad | §9.1 verified; COMPONENTS §14 |
| CP-PIN-21 | Nätverksfel vid Verifiera (`role="alert"`), kod och fält återställs inte | error/live | Koden kunde inte kontrolleras. Försök igen. | §19; COMPONENTS §14 failure |

## 11. Steg 5 av 5 — bokningsbekräftelse på tenanthosten

### 11.1 Huvudspår (bokningen ÄR skapad)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-S5-01 | Rubrik, alla leveranslägen i huvudspåret | heading | Bokningen är klar | §9.2 |
| CP-S5-02 | Faktisk status (chip): `Bekräftad` eller `Förfrågan mottagen` — enligt matris CP-STATUS-01/02 | chip | Bekräftad / Förfrågan mottagen | §9.2 |
| CP-S5-03 | Hjälptext under bekräftelseraden | meta | Öppna länken i meddelandet för att se och hantera bokningen. | §9.2 |
| CP-S5-04 | Primär CTA | button | Lägg i kalender | §9.2/§14 |
| CP-S5-05 | Sekundär CTA (till tenantens bokningsstart) | button | Boka en tid till | §9.2 |
| CP-S5-06 | Stängåtgärd (overlay/fristående `/boka`) | button | Stäng | §9.2 |
| CP-S5-07 | `gateway_persisted`: statusrad (`role="status"`) | live | Bokningen är klar. Bekräftelsen är på väg till [maskerad destination]. | §9.2 gateway_persisted |
| CP-S5-08 | `submitted`: statusrad (`role="status"`) | live | Bekräftelsen är skickad till [maskerad destination] | §9.2 submitted |
| CP-S5-09 | `delivered`: statusrad (`role="status"`) — samma normaltext, inget extra framgångskrav | live | Bekräftelse skickad till [maskerad destination] | §9.2 delivered |
| CP-S5-10 | `delivery_failed`: statusrad (`role="alert"`) — rubriken förblir "Bokningen är klar", leveransfel gör aldrig bokningen osäker | error/live | Bokningen är klar, men bekräftelsen kunde inte levereras. | §9.2 delivery_failed |
| CP-S5-11 | `delivery_failed`: rate-limitad, idempotent CTA | button | Skicka bekräftelsen igen | §9.2 delivery_failed |
| CP-S5-12 | Omskick pending (`aria-disabled`) | button | Skickar… | COMPONENTS §15 |
| CP-S5-13 | Omskick under cooldown (`aria-live="polite"`) | live | Du kan skicka igen om [n] s | COMPONENTS §15 |
| CP-S5-14 | `delivery_failed`: företagskontakt (tel-länk om publik telefon finns) | body | Nås inte bekräftelsen? Ring [Företag] på [nummer]. | §9.2 delivery_failed |
| CP-S5-15 | `unknown`: statusrad (`role="status"`), ingen automatisk dubblettsändning, ingen retry-CTA | live | Bokningen är klar. Vi kontrollerar leveransen av bekräftelsen. | §9.2 unknown |

Ingen text i huvudspårets leveranslägen får påstå att bokningen saknas (§9.2). Persistens och leverans är två separata sanningar (COMPONENTS §15).

### 11.2 Separat felspår (ingen bokning skapades)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-S5-16 | Felvyns rubrik — egen layout, återanvänder aldrig lyckad-bokningslayouten | heading | Bokningen kunde inte slutföras | §9.2 felvy |
| CP-S5-17 | Felvyns brödtext | body | Ingen bokning skapades. | §9.2 felvy; §19 |
| CP-S5-18 | Felvyns primära CTA | button | Tillbaka till lediga tider | §9.2 felvy |

Blandning av spåren ("Bokningen är klar" + "Ingen bokning skapades.") = FAIL (COMPONENTS §15). Ingen sammanfattning, ingen kalender-CTA och ingen "klar"-formulering i felspåret.

---

**Omfattning del 2:** Profil `/mina/profil` (uppgiftskort + exakt meny), redigera namn, VerifiedContactCard, ContactChangeFlow (alla steg och fel), Säkerhet `/mina/sakerhet` (Inloggade enheter + PIN-fria bokningsenheter), destruktiva sessionsdialoger inkl. utloggad-ytan, återhämtning `/aterhamta` + `/verifiera`, bootstrap `/oppna` med alla länklägen, samt korta v1-texter för Hjälp och Integritet.

## 12. Profil `/mina/profil`

### 12.1 Rubrik och uppgiftskort

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-PROF-01 | Sidrubrik (h1) | heading | Profil | §15; COMPONENTS §17 |
| CP-PROF-02 | Uppgiftskortets rubrik (h2) | heading | Mina uppgifter | §15; COMPONENTS §17 |
| CP-PROF-03 | Förklaring under rubriken | meta | Uppgifterna gäller hos [Företag]. | §15 |
| CP-PROF-04 | Namnradens etikett | label | Namn | §15.1; COMPONENTS §17 |
| CP-PROF-05 | Namnradens redigeringsknapp (ghost) | button | Ändra | COMPONENTS §17 |
| CP-PROF-06 | Uppgiftskortet, hämtningsfel (menyn förblir funktionell) | error | Uppgifterna kunde inte hämtas | COMPONENTS §17 |
| CP-PROF-07 | Sekundär knapp vid hämtningsfel | button | Försök igen | COMPONENTS §17 |

### 12.2 Menyn (sluten lista, exakt denna ordning)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-PROF-08 | Menyns tillgängliga namn (`aria-label`) | aria | Profilmeny | COMPONENTS §17 |
| CP-PROF-09 | Post 1 → `/mina/profil` (fokus till uppgiftskortet) | link | Mina uppgifter | §15; COMPONENTS §17 |
| CP-PROF-10 | Post 2 → `/mina/sakerhet` | link | Säkerhet och enheter | §15; COMPONENTS §17 |
| CP-PROF-11 | Post 3 → `/mina/installera` | link | Installera på hemskärmen | §15; COMPONENTS §17 |
| CP-PROF-12 | Post 4 → `/mina/integritet` | link | Integritet | §15; COMPONENTS §17 |
| CP-PROF-13 | Post 5 → `/hjalp` | link | Hjälp | §15; COMPONENTS §17 |
| CP-PROF-14 | Post 6, `<button>` (inte länk) → logout-dialogen (CP-DLG, variant `logout-current`) | button | Logga ut | §15/§16.3; COMPONENTS §17 |

Andra menyposter (login, lösenord, notiser, erbjudanden) = FAIL (COMPONENTS §17). Inget login- eller lösenordselement existerar i produkten.

### 12.3 Redigera namn

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-NAME-01 | Redigeringsformulärets fältetikett | label | Namn | §15.1; COMPONENTS §17 |
| CP-NAME-02 | Sekundär knapp | button | Avbryt | §15.1 |
| CP-NAME-03 | Primär knapp | button | Spara | §15.1 |
| CP-NAME-04 | Valideringsfel (2–120 tecken efter trim, `role="alert"`, ingen serverbegäran) | error/live | Namnet måste vara 2–120 tecken. | §15.1; COMPONENTS §17 |
| CP-NAME-05 | Pending: Spara låst (`aria-disabled`), fältet låst | button | Sparar… | COMPONENTS §17 |
| CP-NAME-06 | Success: åter till visningsläge, fokus på Ändra, toast (`role="status"`) | live | Namnet är sparat. | §15.1; COMPONENTS §17 |
| CP-NAME-07 | Sparfel: kvar i redigeringsläge, värdet behålls (`role="alert"`) | error/live | Namnet kunde inte sparas. Försök igen. | COMPONENTS §17 |

## 13. VerifiedContactCard

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-VC-01 | Delkortets etikett | label | Verifierad kontakt | COMPONENTS §18 |
| CP-VC-02 | Kanalord när primär kontakt är mobil | label | SMS | §15; COMPONENTS §18 |
| CP-VC-03 | Kanalord när primär kontakt är e-post | label | E-post | §15/§15.3; COMPONENTS §18 |
| CP-VC-04 | Verifieringsmärke (bock + text) | chip | Verifierad | §15.3; COMPONENTS §18 |
| CP-VC-05 | Sekundär kontakt som finns men inte är verifierad (endast SMS-verifierad kund med valfri e-post) | chip | Inte verifierad | §15.3 |
| CP-VC-06 | Åtgärd när primär kontakt är mobil — startar ContactChangeFlow med åtgärden `change_phone` | button | Byt telefonnummer | §15.2; COMPONENTS §18 |
| CP-VC-07 | Åtgärd för e-postverifierad kund utan telefon — startar ContactChangeFlow med åtgärden `add_phone` | button | Lägg till mobilnummer | §15.2; COMPONENTS §18 |
| CP-VC-08 | Åtgärd på en e-postrad som faktiskt finns — startar ContactChangeFlow med åtgärden `change_email` | button | Byt e-post | §15.3; COMPONENTS §18 |

`verifiedContact` är en serverstyrd union `sms | email` — kanalordet och det MASKERADE värdet (`maskedDestination`, §22-kontraktet) renderas exakt som servern anger; ingen destination visas någonsin omaskerad. Telefon får saknas (e-postverifierad kund): då finns bara e-postraden — ingen tom telefonrad, ingen platshållare — och åtgärden är CP-VC-07 "Lägg till mobilnummer" (§15.2). Efter godkänt mobiltillägg är mobilen primär verifierad kanal och den tidigare verifierade e-posten ligger kvar som maskerad verifierad reservkontakt (chip CP-VC-04). En valfri sekundär kontakt visas bara om den faktiskt finns (§15). Ingen relation slås ihop automatiskt.

## 14. ContactChangeFlow (dubbelverifierat kontaktbyte)

Dialog/bottom-sheet ovanpå `/mina/profil`; scrim-klick stänger inte; `Esc` = Avbryt utom under pending (COMPONENTS §19). Flödet startas alltid med en serverstyrd åtgärd — `change_phone` (CP-VC-06), `add_phone` (CP-VC-07) eller `change_email` (CP-VC-08). Åtgärden, aldrig fältformatet, avgör den nya destinationens kanal.

### 14.1 Ram

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-CCF-01 | Stegindikator (steg 1–4; steg 5 är kvitto) | meta | Steg [n] av 4 | COMPONENTS §19 |
| CP-CCF-02 | Sekundär knapp i steg 1–4 (avbrutet flöde ändrar ingenting) | button | Avbryt | COMPONENTS §19 |

### 14.2 Steg 1 — Bekräfta identitet (start)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-CCF-03 | Stegrubrik (h2) | heading | Bekräfta att det är du | COMPONENTS §19 |
| CP-CCF-04 | Brödtext — koden går ALLTID till nuvarande primära kontakt, aldrig till något kunden anger | body | Vi skickar en kod till din nuvarande kontakt [maskerad destination]. | COMPONENTS §19 |
| CP-CCF-05 | Dubbelverifieringen förklaras (varför två koder) | body | Av säkerhetsskäl bekräftar du först din nuvarande kontaktuppgift och sedan den nya. | §15.2 punkt 2 |
| CP-CCF-06 | Primär knapp | button | Skicka kod | COMPONENTS §19 |
| CP-CCF-07 | Pending (`aria-disabled`) | button | Skickar kod… | COMPONENTS §19 |
| CP-CCF-08 | Nuvarande kanal otillgänglig — länk från steg 1 till neutral hjälpvy; öppnar aldrig alternativ verifiering | link | Jag kommer inte åt den här kontaktuppgiften | §15.2; COMPONENTS §19 Spärrar |
| CP-CCF-09 | Nätverks-/serverfel vid utskick i steg 1 eller 3 (`role="alert"`), värden behålls | error/live | Något gick fel. Försök igen. | COMPONENTS §19 |

### 14.3 Steg 2 — Ange kod (nuvarande kontakt, step-up)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-CCF-10 | `sent` (SMS): kanalrad (`aria-live="polite"`) | live | Vi har skickat en kod via SMS till [maskerad destination] | §15.2; COMPONENTS §19/§14 |
| CP-CCF-11 | `sent` (e-post): kanalrad (`aria-live="polite"`) | live | Vi har skickat en kod via e-post till [maskerad destination] | §15.3; COMPONENTS §19/§14 |
| CP-CCF-12 | Kodfältets etikett (ETT fält, `one-time-code`) | label | Engångskod | COMPONENTS §14/§19 |
| CP-CCF-13 | Primär knapp | button | Verifiera | COMPONENTS §14/§19 |
| CP-CCF-14 | Pending (`aria-disabled`, fält låst) — täcker även "atomiskt byte pågår" i steg 4 | button | Verifierar… | COMPONENTS §14/§19 |
| CP-CCF-15 | `invalid` (`role="alert"`, fokus åter till fältet) | error/live | Fel kod. Du har [n] försök kvar. | §18 Kontaktbyte; COMPONENTS §14 |
| CP-CCF-16 | `expired` (`role="alert"`) | error/live | Koden har gått ut. Begär en ny kod. | §18 Kontaktbyte; COMPONENTS §14 |
| CP-CCF-17 | `max_attempts`: challenge låst (`role="alert"`) | error/live | För många försök. Begär en ny kod om [n] min. | §18 Kontaktbyte; COMPONENTS §14 |
| CP-CCF-18 | Step-up-fönstret (10 min) förfallet — felyta, hela flödet börjar om | error | Sessionen för bytet har gått ut. Börja om. | §15.2 punkt 3; COMPONENTS §19 |
| CP-CCF-19 | Primär knapp på förfalloytan (till steg 1) | button | Börja om | COMPONENTS §19 |

Cooldown, omskick och leveransfel i kodstegen ärver exakt CP-PIN-11, CP-PIN-12, CP-PIN-13, CP-PIN-16 och CP-PIN-17 (COMPONENTS §19 "ärver §14:s slutna statelista").

### 14.4 Steg 3 — Ny destination (kanalbunden efter åtgärd)

Inget generiskt "mobil eller e-post"-fält finns (§15.2/§15.3). Telefonåtgärderna (`change_phone`/`add_phone`) visar telefonfältet med landskodsväljare och normalisering; `change_email` visar e-postfältet.

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-CCF-20 | Fältetikett, telefonåtgärder (`change_phone`/`add_phone`) | label | Nytt mobilnummer | §15.2 punkt 4; COMPONENTS §19 |
| CP-CCF-33 | Landskodsväljarens etikett (telefonåtgärder; numret normaliseras) | label | Landskod | §15.2 punkt 4; COMPONENTS §19 |
| CP-CCF-21 | Klientvalidering, endast format, telefonåtgärder (`role="alert"`) | error/live | Ange ett giltigt mobilnummer. | COMPONENTS §19 |
| CP-CCF-34 | Fältetikett, `change_email` | label | Ny e-postadress | §15.3; COMPONENTS §19 |
| CP-CCF-35 | Klientvalidering, endast format, `change_email` (`role="alert"`) | error/live | Ange en giltig e-postadress. | §15.3; COMPONENTS §19 |
| CP-CCF-22 | Förhandsinfo om konsekvensen (visas även i steg 5) | meta | Dina andra inloggade enheter loggas ut och dina PIN-fria bokningsenheter återkallas. | §15.2 punkt 8–9; COMPONENTS §19 |
| CP-CCF-23 | Primär knapp (pending = CP-CCF-07) | button | Skicka kod | COMPONENTS §19 |

### 14.5 Steg 4 — Ange kod (ny kontakt)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-CCF-24 | Ny PIN `sent` (SMS till det nya numret; telefonåtgärderna) — separat challenge och separat purpose, ny kod ≠ steg 2-koden (`aria-live="polite"`) | live | Vi har skickat en kod via SMS till [maskerad destination] | §15.2 punkt 5–6; COMPONENTS §19 |
| CP-CCF-25 | Ny PIN `sent` (e-post till den nya adressen; endast `change_email`) (`aria-live="polite"`) | live | Vi har skickat en kod via e-post till [maskerad destination] | §15.3; COMPONENTS §19 |
| CP-CCF-26 | Ny PIN `invalid` (`role="alert"`) | error/live | Fel kod. Du har [n] försök kvar. | §18 Kontaktbyte; COMPONENTS §14 |
| CP-CCF-27 | Ny PIN `expired` (`role="alert"`) | error/live | Koden har gått ut. Begär en ny kod. | §18 Kontaktbyte; COMPONENTS §14 |
| CP-CCF-28 | Ny PIN `max_attempts` (`role="alert"`) | error/live | För många försök. Begär en ny kod om [n] min. | §18 Kontaktbyte; COMPONENTS §14 |
| CP-CCF-29 | Destinationskonflikt, telefonåtgärder (numret hör till annan kundrelation hos samma tenant): ingen merge, inget som avslöjar den andra relationens uppgifter (`role="alert"`) | error/live | Numret används redan. Kontakta [Företag] så hjälper de dig. | §15.2; COMPONENTS §19 Spärrar |
| CP-CCF-38 | Destinationskonflikt, `change_email`: neutralt fel — ingen merge, inget som avslöjar den andra relationen (`role="alert"`) | error/live | Uppgiften kan inte användas. Kontakta [Företag]. | §15.3; COMPONENTS §19 Spärrar |

### 14.4.1 Hjälpvy — nuvarande kanal otillgänglig

| ID | Kontext/state | Typ | Exakt text | Källa |
|---|---|---|---|---|
| CP-CCF-39 | Hjälpvyns rubrik efter CP-CCF-08 | heading | Kan du inte använda din nuvarande kontakt? | §15.2; COMPONENTS §19 Spärrar |
| CP-CCF-40 | Neutral säkerhetsförklaring; ingen reserv-/dokument-/personalsessionsväg får visas | body | Av säkerhetsskäl kan du inte byta kontaktuppgift själv utan kod till din nuvarande kontakt. Kontakta [Företag] för manuell kontroll. | §15.2; COMPONENTS §19 Spärrar |
| CP-CCF-41 | Sekundär åtgärd från hjälpvyn till steg 1 | button | Tillbaka | COMPONENTS §19 Spärrar |

Hjälpvyn visar dessutom exakt en fungerande publik kontaktväg: CP-TID-03 **"Ring"** när telefon finns, annars länken CP-DET-15 **"deras webbplats"** när publik webbplats finns. Ingen kontaktväg får kringgå step-up eller direkt ändra kundrelationen.

Kodfält, Verifiera-knapp och pending är CP-CCF-12/13/14. Dubbelsubmit i steg 4 får aldrig ge dubbelbyte — servern svarar idempotent med samma resultat (COMPONENTS §19).

### 14.6 Steg 5 — Klart

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-CCF-30 | Bekräftelse `change_phone` (bock, `role="status"`) — visas först när båda PIN-bevisen godkänts och bytet skett atomärt | live | Telefonnumret är ändrat. | §15.2 punkt 7–10; COMPONENTS §19 |
| CP-CCF-36 | Bekräftelse `add_phone` (bock, `role="status"`) — mobilen är nu primär verifierad kanal; tidigare verifierad e-post kvar som maskerad reservkontakt | live | Mobilnumret är tillagt. | §15.2; COMPONENTS §19 |
| CP-CCF-37 | Bekräftelse `change_email` (bock, `role="status"`) | live | Kontaktuppgiften är bytt. | §15.3; COMPONENTS §19 |
| CP-CCF-31 | Konsekvensrad (samma text som CP-CCF-22) | meta | Dina andra inloggade enheter loggas ut och dina PIN-fria bokningsenheter återkallas. | COMPONENTS §19 |
| CP-CCF-32 | Primär knapp | button | Stäng | COMPONENTS §19 |

VerifiedContactCard visar det nya läget först EFTER stängning — en halvbytt kontakt får aldrig visas (COMPONENTS §18/§19). Efter `add_phone` visar kortet mobilen som primär och den tidigare verifierade e-posten som maskerad verifierad reservkontakt.

## 15. Säkerhet `/mina/sakerhet`

### 15.1 Rubrik och förklaring

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-SEC-01 | Sidrubrik (h1) | heading | Säkerhet och enheter | §6.2/§16; COMPONENTS §20 |
| CP-SEC-02 | Kort förklaring under rubriken | body | Du använder inget lösenord. Din verifierade mobil eller e-post och dina enhetssessioner skyddar bokningarna. | §16 |

### 15.2 Sektion: Inloggade enheter (endast portalsessioner på `mina.corevo.se`)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-SEC-03 | Sektionsrubrik (h2) — aldrig "Betrodda enheter" | heading | Inloggade enheter | §16.1; COMPONENTS §20 |
| CP-SEC-04 | Enhetsbeskrivning per rad (läsbar enhet/webbläsare) | body | [enhet] · [webbläsare] | §16.1; COMPONENTS §20 |
| CP-SEC-05 | Enhetsbeskrivning när enheten inte kan identifieras | body | Okänd enhet | COMPONENTS §20 |
| CP-SEC-06 | Aktuell session, badge (alltid sorterad först) | chip | Den här enheten | §16.1; COMPONENTS §20 |
| CP-SEC-07 | Destruktiv knapp per ANNAN session → CP-DLG `logout-other` | button | Logga ut | §16.1; COMPONENTS §20 |
| CP-SEC-08 | Destruktiv knapp på AKTUELL session → CP-DLG `logout-current` | button | Logga ut här | COMPONENTS §20 |
| CP-SEC-09 | Samlingsknapp efter listan, endast vid ≥2 sessioner → CP-DLG `logout-all-others` | button | Logga ut alla andra enheter | §16.1; COMPONENTS §20 |
| CP-SEC-10 | Efter lyckad utloggning av annan enhet: raden tas bort (`role="status"`) | live | Enheten är utloggad. | COMPONENTS §20 |
| CP-SEC-11 | Hämtningsfel | error | Enheterna kunde inte hämtas | COMPONENTS §20 |
| CP-SEC-12 | Sekundär knapp vid hämtningsfel | button | Försök igen | COMPONENTS §20 |

Tomläge kan inte inträffa i giltig session (minst den aktuella finns). Ingen IP-adress och ingen platskolumn i standardvyn — sådan data = FAIL (§16.1; COMPONENTS §20).

### 15.3 Sektion: PIN-fria bokningsenheter (egen `<section>`, aldrig ihopslagen med 15.2)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-SEC-13 | Sektionsrubrik (h2) | heading | PIN-fria bokningsenheter | §16.2; COMPONENTS §21 |
| CP-SEC-14 | Förklaringsrad under rubriken | body | På de här enheterna kan du boka hos [Företag] utan att ange en ny kod. | §16.2; COMPONENTS §21 |
| CP-SEC-15 | Destruktiv knapp per post → CP-DLG `revoke-trust` | button | Kräv PIN nästa gång | §16.2; COMPONENTS §21 |
| CP-SEC-16 | Samlingsknapp efter listan, endast vid ≥2 poster → CP-DLG `revoke-all-trusts` | button | Kräv PIN på alla enheter | §16.2; COMPONENTS §21 |
| CP-SEC-17 | Tomläge (ikon + text; ingen CTA — trust skapas endast i bokningsflödet) | body | Inga PIN-fria enheter. | COMPONENTS §21 |
| CP-SEC-18 | Efter lyckad återkallelse: raden tas bort (`role="status"`); "alla" → tomläget | live | PIN krävs nästa gång på enheten. | COMPONENTS §21 |
| CP-SEC-19 | Hämtningsfel | error | Enheterna kunde inte hämtas | COMPONENTS §21 |
| CP-SEC-20 | Sekundär knapp vid hämtningsfel | button | Försök igen | COMPONENTS §21 |

Återkallelse gäller ENDAST framtida PIN-krav på tenanthosten — portalsessionen, pågående och kommande bokningar berörs inte (§16.2; COMPONENTS §21).

## 16. Destruktiva sessionsdialoger (DestructiveActionDialog)

### 16.1 Variantmatris (kanonisk, sluten — rubrik, konsekvens och destruktiv CTA per variant)

| COPY-ID | Variant | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-DLG-01 | `logout-other`: rubrik | heading | Logga ut enheten? | §16.3; COMPONENTS §22 |
| CP-DLG-02 | `logout-other`: konsekvenstext | body | [enhet] loggas ut från dina bokningar. Enheten kan verifiera sig igen med en ny kod. | COMPONENTS §22 |
| CP-DLG-03 | `logout-other`: destruktiv knapp | button | Logga ut enheten | COMPONENTS §22 |
| CP-DLG-04 | `logout-all-others`: rubrik | heading | Logga ut alla andra enheter? | §16.3; COMPONENTS §22 |
| CP-DLG-05 | `logout-all-others`: konsekvenstext | body | Alla enheter utom den här loggas ut. De kan verifiera sig igen med en ny kod. | COMPONENTS §22 |
| CP-DLG-06 | `logout-all-others`: destruktiv knapp | button | Logga ut alla andra | COMPONENTS §22 |
| CP-DLG-07 | `logout-current`: rubrik | heading | Logga ut från den här enheten? | §16.3; COMPONENTS §22 |
| CP-DLG-08 | `logout-current`: konsekvenstext | body | Du loggas ut från dina bokningar på den här enheten. Du kan verifiera dig igen med en ny kod. | COMPONENTS §22 |
| CP-DLG-09 | `logout-current`: destruktiv knapp | button | Logga ut | COMPONENTS §22 |
| CP-DLG-10 | `revoke-trust`: rubrik | heading | Kräv PIN på enheten? | §16.3; COMPONENTS §22 |
| CP-DLG-11 | `revoke-trust`: konsekvenstext | body | [enhet] måste ange en kod vid nästa bokning hos [Företag]. Dina bokningar och din inloggning här påverkas inte. | COMPONENTS §22 |
| CP-DLG-12 | `revoke-trust`: destruktiv knapp | button | Kräv PIN nästa gång | COMPONENTS §22 |
| CP-DLG-13 | `revoke-all-trusts`: rubrik | heading | Kräv PIN på alla enheter? | §16.3; COMPONENTS §22 |
| CP-DLG-14 | `revoke-all-trusts`: konsekvenstext | body | Alla PIN-fria enheter måste ange en kod vid nästa bokning hos [Företag]. Dina bokningar och din inloggning här påverkas inte. | COMPONENTS §22 |
| CP-DLG-15 | `revoke-all-trusts`: destruktiv knapp | button | Kräv PIN på alla | COMPONENTS §22 |

Andra varianter eller texter = FAIL (COMPONENTS §22).

### 16.2 Gemensamma dialogtillstånd

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-DLG-16 | Sekundär knapp, alla varianter | button | Avbryt | §16.3; COMPONENTS §22 |
| CP-DLG-17 | Pending, logout-varianterna: destruktiv CTA låst (`aria-disabled`), Avbryt + `Esc` låsta | button | Loggar ut… | COMPONENTS §22 |
| CP-DLG-18 | Pending, revoke-varianterna | button | Återkallar… | COMPONENTS §22 |
| CP-DLG-19 | Failure: dialogen ligger kvar, CTA:n återställs (`role="alert"`) — ingen session/trust ändrades | error/live | Åtgärden kunde inte genomföras. Försök igen. | §16.3; COMPONENTS §22 |

Redan utloggad session / redan återkallad trust behandlas som success — aldrig fel (idempotent servermutation, §16.3; COMPONENTS §22).

### 16.3 Utloggad-ytan (endast efter lyckad `logout-current`)

Serverposten återkallas först, därefter rensas cookien; hela vyn ersätts av utloggningsytan i recovery-skalet — ingen nav, inga andra CTA:er (§16.3; COMPONENTS §22).

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-DLG-20 | Rubrik (h1) | heading | Du är utloggad | §16.3; COMPONENTS §22 |
| CP-DLG-21 | Primär CTA → `/aterhamta/[tenantSlug]` | button | Få en ny kod | §16.3; COMPONENTS §22 |
| CP-DLG-22 | Sekundär text | body | En giltig, oanvänd bokningslänk kan också öppna Mina bokningar. | §16.3 |
| CP-DLG-23 | Metarad — utloggning raderar inte bokningen och avbokar inte tiden | meta | Dina bokningar finns kvar och påverkas inte. | §16.3 sista stycket |

## 17. Återhämtning — `/aterhamta/[tenantSlug]` och `/verifiera/[tenantSlug]`

Detta är produktens ENDA väg in utan giltig session. Ingen login, inget "skapa konto", ingen tenantväxlare existerar (COMPONENTS §16).

### 17.1 `/aterhamta/[tenantSlug]` (RecoveryForm)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-REC-01 | Sidrubrik (h1) | heading | Kom åt dina bokningar | COMPONENTS §16 |
| CP-REC-02 | Brödtext | body | Ange mobilnumret eller e-postadressen du bokade med hos [Företag], så skickar vi en engångskod. | COMPONENTS §16 |
| CP-REC-03 | Fältetikett (ETT fält för båda formaten) | label | Mobilnummer eller e-post | §6.1; COMPONENTS §16 |
| CP-REC-04 | Klientvalidering, endast format (`role="alert"`, ingen serverbegäran) | error/live | Ange ett giltigt mobilnummer eller en giltig e-postadress. | COMPONENTS §16 |
| CP-REC-05 | Primär knapp | button | Skicka kod | COMPONENTS §16 |
| CP-REC-06 | Pending (`aria-disabled`, fält låst) | button | Skickar… | COMPONENTS §16 |
| CP-REC-07 | Metarad under formuläret | meta | Koden skickas bara till en kontaktuppgift som redan är verifierad hos [Företag]. | §6.1; COMPONENTS §16 |
| CP-REC-08 | Nätverks-/serverfel (`role="alert"`), värdet behålls | error/live | Något gick fel. Försök igen. | COMPONENTS §16 |
| CP-REC-09 | Cooldown (rate limit; neutral — avslöjar inte träff), knapp låst med nedräkning (`aria-live="polite"`) | live | Du kan begära en ny kod om [n] s. | COMPONENTS §16 |
| CP-REC-10 | `max_attempts` (neutral), formuläret låst | error/live | För många försök. Försök igen om [n] min. | COMPONENTS §16 |
| CP-REC-11 | Inhopp från utgången session: toast från skalet (`role="status"`) | live | Din session har gått ut. Verifiera dig igen. | COMPONENTS §16/§1 |

Inmatningen är en uppslagsnyckel — servern väljer alltid själv kanal och skickar ENDAST till en redan verifierad kanal. Träff och icke-träff ger exakt samma svar och navigering (COMPONENTS §16 Kanalval). "Kontot finns inte"-meddelanden = FAIL.

### 17.2 `/verifiera/[tenantSlug]` (kodsteget, `mode="recovery"`)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-VER-01 | Formulärrubrik (h1) | heading | Ange koden | §6.1; COMPONENTS §14/§16 |
| CP-VER-02 | Neutral kanalrad — ALLTID denna text, träff eller ej (`aria-live="polite"`) | live | Om uppgiften finns hos oss har vi skickat en kod. | COMPONENTS §16 Kanalval |
| CP-VER-03 | Maskerad kanalrad, servervald SMS — visas ENDAST när utskick faktiskt skett och maskeringen inte avslöjar mer än kunden själv angav | meta | Koden skickades via SMS till [maskerad destination] | §18 Återhämtning; COMPONENTS §16 |
| CP-VER-04 | Maskerad kanalrad, servervald e-post — samma villkor som CP-VER-03 | meta | Koden skickades via e-post till [maskerad destination] | §18 Återhämtning; COMPONENTS §16 |
| CP-VER-05 | Kodfältets etikett (ETT fält, `one-time-code`) | label | Engångskod | COMPONENTS §14 |
| CP-VER-06 | Primär knapp | button | Verifiera | COMPONENTS §14 |
| CP-VER-07 | Pending (`aria-disabled`, fält låst) | button | Verifierar… | COMPONENTS §14 |
| CP-VER-08 | `invalid` (`role="alert"`, fokus åter till fältet, värdet kvar) | error/live | Fel kod. Du har [n] försök kvar. | §18 Återhämtning; COMPONENTS §14 |
| CP-VER-09 | `cooldown`: omskickskontrollen inaktiv, nedräkning (`aria-live="polite"`) | live | Skicka ny kod om [00:ss] | COMPONENTS §14 |
| CP-VER-10 | `resend_ready`: omskicksknapp (ny kod ogiltigförklarar gammal) | button | Skicka ny kod | COMPONENTS §14 |
| CP-VER-11 | Efter omskick: bekräftelse i kanalraden (`aria-live="polite"`) | live | En ny kod har skickats. | COMPONENTS §14 |
| CP-VER-12 | `expired` (`role="alert"`), Verifiera låst tills ny kod begärts | error/live | Koden har gått ut. Begär en ny kod. | §18 Återhämtning; COMPONENTS §14 |
| CP-VER-13 | `max_attempts` (neutral, `role="alert"`), formuläret låst | error/live | För många försök. Försök igen om [n] min. | §18 Återhämtning; COMPONENTS §16 |
| CP-VER-14 | `delivery_failed` (kanalneutral — avslöjar aldrig kanal eller träff, `role="alert"`) | error/live | Koden kunde inte skickas. Försök igen. | §18 Återhämtning; §19 |
| CP-VER-15 | `verified`: kort bekräftelse (bock + text, `role="status"`), därefter replace-navigering till `/mina` | live | Verifierad | §18 Återhämtning; COMPONENTS §14 |

## 18. Bootstrap `/oppna/[tenantSlug]#<token>` och länklägen

### 18.1 Kontroll pågår

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-BOOT-01 | Rubrik (h1), visas omedelbart med neutral spinner/skeleton | heading | Öppnar din bokning | §8.2 |
| CP-BOOT-02 | Text under rubriken | body | Vi kontrollerar länken säkert. Det tar oftast bara ett ögonblick. | §8.2 |

Visas aldrig: telefonnummer, kundnamn, bokningsdetaljer, token, tekniskt fel-ID eller en falsk inloggningsknapp (§8.2). Lyckat utbyte navigerar med `replace` — ingen egen copy.

### 18.2 JavaScript avstängt (`<noscript>`, serverrenderad)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-BOOT-03 | Rubrik | heading | JavaScript behövs för att öppna den säkra länken | §8.2 |
| CP-BOOT-04 | Text | body | Aktivera JavaScript och ladda om sidan, eller be om en ny kod. Inga bokningsuppgifter har visats. | §8.2 |
| CP-BOOT-05 | Länk 1 → `/aterhamta/[tenantSlug]` | link | Få en ny kod | §8.2 |
| CP-BOOT-06 | Länk 2 → tenantens publika bokningssida | link | Till företagets bokningssida | §8.2 |
| CP-BOOT-07 | Länk 3 → `/hjalp` | link | Hjälp | §8.2 |

### 18.3 Giltig men redan förbrukad länk

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-BOOT-08 | Förbrukad + session saknas: rubrik | heading | Länken har redan öppnats på en annan enhet | §8.3 |
| CP-BOOT-09 | Förbrukad + session saknas: primär knapp → `/aterhamta/[tenantSlug]` | button | Skicka ny kod | §8.3 |

Förbrukad länk + giltig session på samma enhet: rätt portal/bokning öppnas direkt utan ny PIN — ingen copy renderas (§8.3). Ingen text får avslöja om något annat telefonnummer eller kundkonto finns.

### 18.4 Utgången, felaktig eller återkallad länk (EN gemensam yta)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-BOOT-10 | Rubrik — samma för utgången, felaktig och återkallad | heading | Länken kan inte användas | §8.4 |
| CP-BOOT-11 | Neutral förklaring som täcker alla tre fallen utan att skilja dem åt | body | Länken är inte längre giltig. Den kan ha gått ut, redan använts eller ersatts av en nyare länk. | §8.4 |
| CP-BOOT-12 | Primär knapp → `/aterhamta/[tenantSlug]` | button | Skicka ny kod | §8.4 |
| CP-BOOT-13 | Sekundär länk | link | Till företagets bokningssida | §8.4 |
| CP-BOOT-14 | Hjälptext om bytt kontaktuppgift | meta | Har du bytt mobilnummer eller e-post? Kontakta [Företag] så hjälper de dig. | §8.4 |

Känd och okänd uppgift ger samma statuskod, responsform och copy (§8.4).

## 19. Hjälp `/hjalp` och Integritet `/mina/integritet` (korta v1-texter)

### 19.1 Hjälp (publik, utan personuppgifter och utan tenantdata)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-HELP-01 | Sidrubrik (h1) | heading | Hjälp | §6.1 |
| CP-HELP-02 | Stycke 1 | body | Mina bokningar är en säker sida där du ser och hanterar dina bokningar hos företag som använder Corevo. | §6.1 |
| CP-HELP-03 | Stycke 2 | body | Din personliga länk finns i bokningsbekräftelsen du fick via SMS eller e-post. Länken fungerar bara en gång. | §8.1 |
| CP-HELP-04 | Stycke 3 | body | Kommer du inte in? Begär en ny kod via länken i din bekräftelse, eller kontakta företaget du bokade hos. | §6.1/§8.4 |
| CP-HELP-05 | Stycke 4 | body | Frågor om en bokning, ett pris eller en avbokning besvaras av företaget du bokade hos. | §6.1 |

### 19.2 Integritet (kort förklaring och datarättigheter)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-PRIV-01 | Sidrubrik (h1) | heading | Integritet | §6.2 |
| CP-PRIV-02 | Stycke 1 | body | Vi sparar ditt namn, din verifierade kontaktuppgift och dina bokningar hos [Företag]. | §6.2/§22 |
| CP-PRIV-03 | Stycke 2 | body | Uppgifterna används bara för att hantera dina bokningar och skicka bekräftelser och påminnelser. De säljs aldrig vidare. | §6.2/§27 |
| CP-PRIV-04 | Stycke 3 | body | Du använder inget lösenord. Din verifierade mobil eller e-post och dina enhetssessioner skyddar bokningarna. | §16 |
| CP-PRIV-05 | Stycke 4 (datarättigheter) | body | Vill du rätta eller radera dina uppgifter? Kontakta [Företag] så hjälper de dig. | §6.2/§27 |

---

**Omfattning del 3:** PWA-installation (installationskortet med hela erbjudande-maskinen, Android/Chromium, iOS-guiden, in-app-webbläsare, `/mina/installera`, standalone), offline och installerat läge, skalnivåns fel-/tomläges-/skelettytor (PortalErrorState/PortalEmptyState/PortalSkeleton), tillgänglighetsregister (aria-namn), den bindande förbudslistan för copy samt placeholderregistret med dataexponeringsregler.

## 20. PWA-installation — InstallPromptCard

### 20.1 Installationskortet (automatiskt erbjudande på `/mina`, alltid EFTER bokningsinnehållet)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-PWA-01 | Kortets rubrik (h2), alla stödda miljöer | heading | Ha dina bokningar nära till hands | §17.3; COMPONENTS §23 |
| CP-PWA-02 | Brödtext under rubriken | body | Snabb åtkomst till dina bokningar, direkt från hemskärmen. | COMPONENTS §23 |
| CP-PWA-03 | Android/Chromium (`eligible`/`prompted_once`/`prompted_twice`, fångad `beforeinstallprompt`): primär CTA — native-prompten anropas ENDAST som direkt svar på klicket | button | Lägg på hemskärmen | §17.3; COMPONENTS §23 |
| CP-PWA-04 | Avböj-knapp (ghost), alla miljövarianter — `prompted_once` → `dismissed_once`, `prompted_twice` → `dismissed_twice` | button | Inte nu | §17.2/§17.3; COMPONENTS §23 |
| CP-PWA-05 | Android, `beforeinstallprompt`-eventet saknas i övrigt stödd Chromium-miljö: ENDAST denna länk, aldrig en knapp som låtsas installera | link | Så installerar du | §17.3 |
| CP-PWA-06 | Android, offline: primär CTA `aria-disabled`, metarad under | meta | Kräver internetanslutning. | COMPONENTS §23 |

Tillståndsregler utan egen copy (§17.2; COMPONENTS §23): `unsupported` → kortet renderas INTE på `/mina`, inget synligt. `standalone` → kortet renderas ALDRIG, ingen installationsfråga. `dismissed_once` → kortet döljs resten av besöket; andra och sista erbjudandet (`prompted_twice`) sker tidigast vid ett senare separat besök och använder exakt CP-PWA-01–04 — ingen ny formulering, ingen "sista chansen"-copy. `dismissed_twice` → aldrig mer automatiskt; ingen påminnelse, toast eller banner. `accepted` → allt döljs. Max två verkliga erbjudanden per enhet = bindande; fler = FAIL.

### 20.2 iOS Safari — knapp och IosInstallGuide

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-IOS-01 | iOS Safari: primär CTA i kortet (webbplatsen kan inte installera sig själv — ingen fejkad installationsknapp) | button | Visa hur | §17.4; COMPONENTS §23 |
| CP-IOS-02 | Guidens rubrik (h2, `aria-labelledby`) | heading | Så lägger du till på hemskärmen | COMPONENTS §24 |
| CP-IOS-03 | Steg 1 (`<ol>`, dela-ikon; citerar iOS eget UI ordagrant) | body | Tryck på Dela | §17.4; COMPONENTS §24 |
| CP-IOS-04 | Steg 2 (plus-i-fyrkant-ikon) | body | Välj Lägg till på hemskärmen | §17.4; COMPONENTS §24 |
| CP-IOS-05 | Steg 3 | body | Tryck på Lägg till | §17.4; COMPONENTS §24 |
| CP-IOS-06 | Bekräftelserad efter stegen | body | Klart — Mina bokningar finns på hemskärmen. | §17.4 |
| CP-IOS-07 | Stängknapp (sheet/dialog; utgår i inline-läget på `/mina/installera`) | button | Stäng | COMPONENTS §24 |

Stegtexterna är låsta — de speglar iOS svenska UI. Andra formuleringar, extra steg eller skärmdumpar med persondata = FAIL (COMPONENTS §24).

### 20.3 In-app-webbläsare (Instagram/Facebook/Messenger m.fl.)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-APP-01 | Ersättningstext i kortet (Safari-menyn saknas — guiden visas inte här) | body | Öppna sidan i Safari för att lägga till den på hemskärmen | §17.4; COMPONENTS §23 |
| CP-APP-02 | Primär CTA — kopierar portalens `/mina`-URL till urklipp | button | Kopiera länken | §17.4; COMPONENTS §23 |
| CP-APP-03 | Lyckad kopiering, statusrad (`role="status"`) | live | Länken är kopierad | §17.4; COMPONENTS §23 |
| CP-APP-04 | Steg 1 (`<ol>`) | body | 1. Kopiera länken. | §17.4 |
| CP-APP-05 | Steg 2 | body | 2. Öppna Safari. | §17.4 |
| CP-APP-06 | Steg 3 | body | 3. Klistra in länken i adressfältet. | §17.4 |
| CP-APP-07 | Endast när miljön exponerar en verifierat fungerande systemåtgärd — aldrig en gissad URL-scheme-länk som kan bli en död knapp | button | Öppna i Safari | §17.4; COMPONENTS §23 |
| CP-APP-08 | Misslyckad urklippsåtkomst (`role="alert"`), adressen visas i mono för manuell kopiering | error/live | Länken kunde inte kopieras. Markera och kopiera adressen manuellt. | COMPONENTS §23 |

### 20.4 Manuell sida `/mina/installera` (`placement="page"`)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-INST-01 | Dokumenttitel | title | Installera – [Företag] | §20; COMPONENTS §1 |
| CP-INST-04 | Sidrubrik (exakt en h1) | heading | Installera på hemskärmen | §15/§17; COMPONENTS §23 |
| CP-INST-02 | `unsupported`: ärlig text, inga CTA:er | body | Din webbläsare stöder inte installation. | COMPONENTS §23 |
| CP-INST-03 | `standalone`: bekräftelse (bock), inga CTA:er | body | Appen är installerad. | COMPONENTS §23 |

Sidan visar i övrigt samma kort som 20.1–20.3 men utan "Inte nu" (stängs via navigation) och räknas ALDRIG som ett av de två automatiska erbjudandena — alltid nåbar, även efter `dismissed_twice` (COMPONENTS §23). Manifestet är Corevo-neutralt (`name` `Mina bokningar · Corevo`, `short_name` `Mina bokningar`, scope `/mina/`) och får aldrig innehålla kundnamn, tenantnamn, tokens eller boknings-ID:n (§17.1) — manifestet innehåller ingen kundsynlig copy utöver appnamnet.

## 21. Offline och installerat läge

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-OFF-01 | Offline, neutral statisk felyta — ERSÄTTER innehållet; gammal personlig bokningsdata får aldrig visas ur cache; statiskt skal (topbar/nav) får synas | error | Du är offline. Anslut till internet för att se aktuella bokningar. | §17.5; COMPONENTS §26 |
| CP-OFF-02 | Sekundär knapp på offline-ytan | button | Försök igen | COMPONENTS §26 |
| CP-OFF-03 | Sekundär knapp under omförsök (`aria-disabled`) | button | Hämtar… | COMPONENTS §26 |

Utgången session i installerat läge visar återhämtningsvyn (CP-REC-01–11) med toasten CP-REC-11 — aldrig vit skärm, redirect-loop eller login (§17.5; COMPONENTS §26 `session-expired`). Standalone-läget har ingen egen copy: sessionen fungerar identiskt i browser och standalone, och installationsfrågan visas aldrig (§17.2/§17.5).

## 22. Skalnivåns fel, tomlägen och skelett

### 22.1 PortalErrorState — serverfel och kanoniska hämtningsfel

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-ERR-01 | `server`: rubrik (fel hos oss, inte hos kunden) | heading | Något gick fel hos oss. | §19; COMPONENTS §26 |
| CP-ERR-02 | `server`: brödtext — "Något gick fel" står ALDRIG ensamt | body | Försök igen om en stund. | §19; COMPONENTS §26 |
| CP-ERR-03 | `server`: sekundär knapp | button | Försök igen | COMPONENTS §26 |
| CP-ERR-04 | `server`: valfri kopierbar fel-ID-rad (mono, efter stödtexten) — koden är opersonlig, exempel `Felkod: CP-7F3K` | meta | Felkod: [fel-id] | §19; COMPONENTS §26 |
| CP-ERR-05 | Retry pending, alla felytor (`aria-disabled`; texten bär tillståndet, aldrig spinner-endast) | button | Hämtar… | COMPONENTS §26 |

Sluten lista över `fetch`-ytnamn — redan definierade som CP-HOME-20 (Bokningarna), CP-HIST-10 (Historiken), CP-PROF-06 (Uppgifterna), CP-SEC-11/CP-SEC-19 (Enheterna) och CP-DET-16 (Bokningen); inga andra ytnamn är tillåtna (COMPONENTS §26). Ägarskaps-404 = CP-DET-18. `session-expired` har ingen egen felyta — shellen navigerar till `/aterhamta/[tenantSlug]` (COMPONENTS §26). Fel-ID får aldrig innehålla kund-, sessions- eller boknings-identifierare (§19). Databastermer, UUID, stack trace, provider- eller rått API-fel i någon feltext = FAIL (§19).

### 22.2 PortalEmptyState — register (texterna redan bundna)

Portalens ärliga tomlägen är redan definierade och återanvänds oförändrade: `/mina` = CP-HOME-14/15/16/17 (§10.5), historik = CP-HIST-06 (§11), PIN-fria enheter = CP-SEC-17 (COMPONENTS §21). Inloggade enheter kan inte bli tomma i giltig session (COMPONENTS §20). Ett tomläge lånar aldrig en annan ytas copy, visar aldrig exempeldata, annonseras aldrig som fel och renderas först när hämtningen lyckats med noll poster — fel ≠ tomt (COMPONENTS §25).

### 22.3 PortalSkeleton — laddlägen

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-SKEL-01 | ETT visuellt dolt textalternativ per värdyta (statisk text; alla visuella block `aria-hidden="true"`, INGEN `aria-live`, INGET `role="status"`) | aria | Laddar innehåll | COMPONENTS §27 |

Skelettblocken innehåller aldrig texter, namn, tider eller platshållarord — ett skeleton som ser ut som data = FAIL (COMPONENTS §27). Varianterna (`identity`/`hero`/`row`/`detail`/`profil`) har ingen ytterligare copy.

## 23. Tillgänglighetsregister (aria-namn och live-regioner)

| COPY-ID | Yta / state | Nivå | Exakt text | Briefref |
|---|---|---|---|---|
| CP-A11Y-01 | Skip-länk = CP-SHELL-01; navens namn = CP-NAV-01; profilknappen = CP-TOP-03 (register, inga nya strängar) | aria | — (se respektive ID) | §20; COMPONENTS §1–3 |
| CP-A11Y-02 | Stängknapp (X) i alla dialoger/sheets som har en: avbokningsdialogen, ContactChangeFlow, iOS-guiden | aria | Stäng | §20; COMPONENTS §11/§19/§24 |
| CP-A11Y-03 | Synlig tillbaka-åtgärd bär sin egen text ("Tillbaka", CP-TOP-04/CP-DET-01) — inget avvikande aria-namn | aria | Tillbaka | §12; §20 |
| CP-A11Y-04 | Dialoger: `role="dialog"` + `aria-modal="true"`, rubriken via `aria-labelledby`, sammanfattning via `aria-describedby` — rubriktexterna är CP-CAN-01, CP-DLG-01/04/07/10/13, CP-IOS-02 | aria | — (se respektive ID) | §20; COMPONENTS §11/§22/§24 |
| CP-A11Y-05 | Statuschipens text bär alltid statusen (CP-STATUS-01–07) — färg är aldrig enda bärare; ikonknappar har tillgängligt namn | aria | — (se respektive ID) | §20 |

Live-regionsregler (§20): bekräftelser (`role="status"`/`aria-live="polite"`) = CP-CAN-08, CP-CAL-03, CP-NAME-06, CP-SEC-10, CP-SEC-18, CP-CCF-30/36/37, CP-PIN-20, CP-VER-15, CP-S5-07/08/09/15, CP-APP-03, CP-REC-11. Fel (`role="alert"`) = alla `error/live`-rader. Nedräkningar (CP-PIN-11, CP-VER-09, CP-REC-09, CP-S5-13) är `aria-live="polite"` utan fokusstöld. Aggressiv alert för icke-fel = FAIL.

## 24. Förbjuden copy (bindande negativlista)

Följande ord/ytor får INTE förekomma i någon route, komponent, navpost, CTA, tom-/felyta, dialog eller manifest i v1. Förekomst = FAIL (COMPONENTS §30; §3.2).

| COPY-ID | Förbjuden copy/yta | Varför | Briefref |
|---|---|---|---|
| CP-NEG-01 | "Logga in", "Skapa konto", "Lösenord", "Glömt lösenord", social inloggning ("Fortsätt med Google/Apple/Facebook") | Ingen login existerar; enda vägen in utan session är `/aterhamta/[tenantSlug]` | §2; COMPONENTS §30 |
| CP-NEG-02 | "Mina företag", tenantväxlare, företagslista, cross-tenant-vy | En session = exakt EN tenant | COMPONENTS §30 |
| CP-NEG-03 | Erbjudande-/kampanjcopy ("Erbjudande", "Kampanj", rabattbanners) | Erbjudanden är förbjudna i v1 | §3.2; COMPONENTS §30 |
| CP-NEG-04 | Lojalitetscopy ("Poäng", "Stämplar", "Klippkort", "Nivå") | Lojalitet är förbjuden i v1 | §3.2; COMPONENTS §30 |
| CP-NEG-05 | Push-copy ("Aktivera notiser", notisinställningar, permission-prompt) | Push är förbjuden i v1 | §3.2; COMPONENTS §30 |
| CP-NEG-06 | Webshop-copy ("Produkter", "Varukorg", "Köp") | Webshop är förbjuden i v1 | §3.2; COMPONENTS §30 |
| CP-NEG-07 | "Kommer snart", "Under uppbyggnad" och andra platshållarytor | Inaktiva funktioner är dolda, aldrig annonserade | §3.2 |
| CP-NEG-08 | "Omboka"/ombokningscopy i portalen | Portalen ombokar aldrig — endast Avboka + utlänk till tenantens publika flöde | COMPONENTS §30 |
| CP-NEG-09 | "Ladda ned appen", App Store-/Play-länkar | PWA-installation är enda install-vägen | COMPONENTS §30 |
| CP-NEG-10 | "Något gick fel" ENSAMT (utan vad kunden kan göra och om bokningen påverkades) | Feltonalitetslagen | §19 |
| CP-NEG-11 | "Kontot finns inte" / existensavslöjande text i återhämtning, bootstrap eller kodsteg | Säkerhetsfel är medvetet neutrala | §19; COMPONENTS §16 |
| CP-NEG-12 | "Betrodda enheter" som rubrik för portalsessioner | Rubriken är låst till "Inloggade enheter" (CP-SEC-03) | §16.1; COMPONENTS §20 |

## 25. Placeholderregister del 3 och dataexponeringsregler

Tillkommande placeholders utöver del 1-tabellen:

| Placeholder | Betydelse | Exempel (fixture) |
|---|---|---|
| `[fel-id]` | Opersonlig, kopierbar felkod ur felsvaret — aldrig fri prop | CP-7F3K |
| `[enhet]` | Läsbar enhetsbeskrivning ur sessionsposten | iPhone · Safari |
| `[Sidnamn]` | Sidans namn i dokumenttiteln (CP-SHELL-02) | Bokningar |

Bindande exponeringsregler (§19; §27; COMPONENTS §26/§30):

- Inga interna ID:n visas någonsin i UI-text: inga UUID, tenant-ID:n, kund-ID:n, boknings-ID:n, sessions-ID:n eller databastermer.
- Tokens (bootstrap-länkens `#<token>`) renderas aldrig som text, loggas aldrig i synlig copy och läcker aldrig i felmeddelanden (§8.2).
- PIN-koder visas aldrig i klartext i något UI-tillstånd — fältet ekar bara kundens egen inmatning; ingen kod förifylls eller exponeras i fel/bekräftelser.
- Destinationer visas alltid maskerade (`[maskerad destination]`) och aldrig med mer information än kunden själv angav (COMPONENTS §16).
- Felkoden (`[fel-id]`) är opersonlig och kan inte slås tillbaka till person, bokning eller session utanför serverloggen.
- Varje sträng i denna fil är exakt; synonymer, omformuleringar eller nya strängar utan briefbeslut = FAIL (COMPONENTS §31).

---

**COPY KOMPLETT — 3 av 3**
