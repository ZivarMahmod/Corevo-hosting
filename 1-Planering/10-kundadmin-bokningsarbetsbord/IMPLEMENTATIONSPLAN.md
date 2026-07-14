# Implementationsplan — Kund-admin (superadmin-skal + Wavys enkelhet i kalendern)

**Skapad:** 2026-07-14 · **Status:** aktiv arbetslista (en punkt i taget, uppifrån och ner)

## Uppgiften i tre meningar

Kund-adminen ska **se ut som superadmin** (samma ljusa designspråk, samma toppnav, samma komponenter).
Kalendern ska ge **Wavys enkelhet** — hela bokningsarbetet i en yta, utan sidbyte.
Vi **bygger om det vi redan har** enligt Wavy-lärdomarna; vi bygger inte ett parallellt system.

## Vad som INTE görs (medvetet bortvalt — ponytail)

- Sajtbyggarens editor-UI byggs inte om. Den är starkare än Wavys. Den får bara en ny ingång.
- Inställningarna designas inte om från grunden. Sidorna finns och funkar — de **flyttar i navet**, inget mer.
- Ingen ny kompontentsvit. Superadmins komponenter (PageHead, StatCard, Badge, Dropdown, CommandPalette,
  Toast, SaveBar, TwoStepDanger) återanvänds rakt av. Nytt byggs bara där det saknas: kalendergrid + drawer.
- Tillägg i bokning, återkommande kundbokning, SMS, TOTP, PWA — egna beslut senare. Blockerar ingenting.
- Statistikyta. Medvetet avsteg från Wavy.

---

## Kodnuläge — vad som händer med varje del

| Finns idag | Öde |
|---|---|
| `(platform)` + `PlatformTopnav` + `portal-global.css` — **superadmins ljusa skal** | **Källan.** Generaliseras till ett delat skal som båda portalerna använder |
| `(admin)` → `PortalShell` → `PortalSidebar` (mörkgrön) | **Byts ut** mot toppnavskalet. Sidorna inuti ärver det gratis |
| `nav-items.ts` — enda navkällan, med modulgating (`module` + `activeModuleKeys`) | **Behålls.** Grupperna mappas om till toppnavposter. Gatingen är redan rätt |
| `admin/page.tsx` — dagens dashboard | **Ersätts** av ny Översikt |
| `BookingsClient` (kortström), `SlotManager`, `DropInColumn` | **Ersätts** av kalenderarbetsbordet. Enda stället vi bygger genuint nytt |
| `ServicesManager`, `StaffRoster`, `ScheduleWeekBoard`, `TimeOffManager`, `LocationsManager`, `SettingsForm`, `StripeConnectCard` | **Orörda.** Flyttar in under Inställningar i navet — samma kod |
| `admin/sida` (`SiteEditor`) | **Orörd.** Blir huvudvalet "Redigera sidan" |
| Moduler: webshop, blogg, kurser, lojalitet, presentkort, offerter, media | **Orörda.** Aktiva moduler blir egna toppnavposter (Zivars beslut 2026-07-14) |
| `RealtimeBookings` (Supabase Realtime) | **Återanvänds** — ger kalendern livesynk gratis. Bygg ingen ny kanal |

**Nya toppnaven** (en frisör utan moduler ser exakt fem val — det ÄR Wavy-enkelheten):

```text
Översikt · Kalender · Kunder · [aktiva moduler] · Redigera sidan · Inställningar
```

---

## Wavy-lärdomarna vi bygger in (ur `claude/WAVY-UX-ANALYS.md`)

Det här är vad "samma enkelhet, bättre byggt" konkret betyder:

| Wavy-mekanik | Varför den funkar | Bättre hos oss |
|---|---|---|
| Vald tjänst ritar alla **giltiga luckor** som klickbara chips | Dubbelbokning blir nästan omöjlig — förhindra i stället för felmeddela | Samma, men med tangentbordsväg |
| Sök + skapa kund i **ETT fält**, bara namn krävs | Ofarlig default: ingen kontaktväg ⇒ inga notiser ⇒ inget oavsiktligt utskick | Samma + kundsök utan att starta bokningsflöde (Wavy tvingar låtsasbokning) |
| **Drag & släpp**-flytt med konkret konsekvenstext ("från Vera till Ines?") | Snabbaste ombokningen som finns | Samma + explicit Flytta-knapp (Wavy har ingen tangentbordsväg alls) |
| **Blockering = universalmekanism** för rast/frånvaro/avvikelse, med upprepning | En mekanism, fyra behov. Ingen schemamodul behövs | Samma, kopplad till schemat vi redan har |
| Serieändring **"endast denna" / "denna och framåt"** — historik skrivs aldrig om | Löser klassikern elegant | Samma |
| **30-dagars ångralogg** (vem/när/källa + Återställ per rad) | Gör misstag billiga → färre varningsdialoger behövs | Samma |
| **Soft delete** — kund döljs, raderas aldrig | GDPR-historik intakt | Samma (vi har redan build-once-never-delete) |
| Bekräfta **bara det oåterkalleliga** — skapa = ingen dialog; flytta/avboka = konkret text, aldrig "Är du säker?" | Rätt friktion på rätt ställe | Samma |
| **Realtid utan spara-knappar** i driften; utkast/publicera bara i admin | Systemstatus = verklighet | Samma — `RealtimeBookings` finns redan |
| **15-min snappning**, relativa veckor, "+4 v"-hopp | Salonger tänker i veckor | Samma, steg konfigurerbart via bokningsregler |
| Färg + namn = personidentitet i varje vy | Ser på en tiondels sekund vems bokning det är | Bättre: identiteten bärs av **namnet**, färgen förstärker (färgblinda) |
| **Flyttbarhetsflagga** ("stjärnan"): valde kunden en specifik person? | 1 boolean kodar hela ombokningsfriheten | Samma — löjligt billigt, stort värde |

**Där Wavy är dåliga och vi INTE kopierar:** tillgänglighet nära noll (0 landmärken, fokus avstängt,
zoom blockerad), ingen rollstyrning, AM/PM-bugg i en 24h-app, kalendern som enda skärm.

**Krock, redan avgjord:** analysen rekommenderar "kalendern = hela appen". Överkört av det låsta beslutet
(`codex/00` §2): Översikt är startsidan, Kalender är **ett klick** bort. Vi tar Wavys arbetsflöden,
inte deras en-skärms-arkitektur.

---

## Klickbudget — hårda acceptanskrav (testas i e2e, överskridet = FAIL)

| Uppgift | Max klick | Tangenttryck | Beslut |
|---|---|---|---|
| Boka befintlig kund, idag | 5 | 0 | 3 (tjänst · lucka · kund) |
| Boka befintlig kund om 4 veckor | 6 | 0 | 4 |
| Boka ny kund | 6 | namn | 3 |
| Flytta bokning (tid eller resurs) | 2 (drag + bekräfta) | 0 | 1 |
| Avboka | 3 | 0 | 1 |
| Återställ avbokad | 2 | 0 | 1 |
| Blockera lunch varje dag | 4 | 0 | 2 |
| Byt dag · dag↔vecka · filtrera resurs | 1 | 0 | 1 |

Tangentbordsvägen får kosta fler steg än musvägen — men den måste finnas för allt ovan.

---

## Arbetsregler

- **En punkt i taget.** Klart = mekaniskt verifierat (test grönt), aldrig "ser rätt ut".
- **Designtrohet:** när `design/Kund-admin.dc.html` finns är den LAG — exakta px/hex/font lyfts ur filen,
  aldrig re-härleds, aldrig improviseras.
- **Generellt, aldrig branschspecifikt.** Inget `if (frisör)`. Etiketter från preset/vertical.
- **Tenantgräns:** kund-admin ser bara sin tenant, aldrig superadminfunktioner. `private.tenant_id()`, `staff`/`staff_id`.
- **Build-once-never-delete.** Gamla ytor byts ut, data raderas aldrig.
- Avklarad punkt bockas av här (`[x]`) med datum.

---

# L1 — Skalet (kund-admin ser ut som superadmin)

- [x] **A-01** *(2026-07-14)* Superadmin-facit läst. **Beslut:** ingen mockup produceras (Zivar 2026-07-14) —
      facit är superadminens KOD: `Topnav.module.css` (tokens), `Topnav.tsx`, `components/portal/ui/`.
      Regeln som ersätter designtroheten: varje färg/radie/mått lyfts ur dessa filer, noll nya värden.
- [x] **A-02** *(2026-07-14)* Utgår — se A-01. Nya element (`.context`, `.extra`) byggda enbart av befintliga tokens.
- [x] **A-03** *(2026-07-14)* Utgår — se A-01.
- [x] **A-04** *(2026-07-14)* `PlatformTopnav` → `Topnav`: rolldrivet skal (områden, subnav, varumärke,
      primärhandling, kontextlänk, extra-slot som props). Superadmin skickar exakt sina gamla värden,
      CSS-klasserna oförändrade. `platform-navigation.test.tsx` grön = ingen regression.
- [x] **A-05** *(2026-07-14)* `admin-navigation.ts`: `Översikt · Kalender · Kunder · [aktiva moduler] ·
      Redigera sidan · Inställningar`. Modulposterna hämtas ur `nav-items.ts` (enda sanningen, gatingen
      återanvänd). Tjänster/Personal/Scheman/Platser blev subnav under Inställningar.
      De nio kategorierna kräver routes som inte finns än → L3 (C-01). Inga 404-platshållare.
- [x] **A-06** *(2026-07-14)* `PortalShell`: admin-grenen renderar toppnavskalet i stället för
      `PortalSidebar`. Personal-portalen behåller sidofältet. `next build` grön — alla adminsidor renderar.
- [x] **A-07** *(2026-07-14)* Topbar: verksamhetens namn + "via Corevo" (aldrig "Superadmin") · ⌘K via
      `paletteFromNav('admin', activeModuleKeys)` · platsväljare vid >1 plats (befintlig logik) ·
      tema-switch · "Öppna min sida" · avatarmeny med roll.
- [x] **A-08** *(2026-07-14)* Rollgränstest i `admin-navigation.test.ts`: alla hrefs ligger under `/admin`,
      `/salonger` kan inte förekomma, inaktiv modul syns aldrig. `requirePortal('admin')` orörd.
- [x] **A-09** *(2026-07-14)* Ny Översikt: bokningar idag (varav obekräftade) · nästa besök · denna vecka ·
      **Kräver uppmärksamhet** (obekräftade, en Öppna-knapp per rad, ärligt tomläge) · Kommande idag
      (max 6, → kalendern) · **Personal idag** (ny `staffDay()` i `lib/admin/data.ts` — EN läsning, används
      av kalenderns kolumner i B-01) · driftvarning bara när publik bokning faktiskt är pausad ·
      EN primärknapp "Öppna kalendern".
      **Borttaget:** marknadsföringskortet "Röd tråd", snabbåtgärdsraden och topptimmar-diagrammet
      (fyra vägar till sajten + statistik på entrén = precis det codex/00 §2 förbjuder), samt en död
      kundläsning (upcomingToday bär redan det maskerade namnet). `QuickActions.tsx` raderad.
      **Beläggning i procent hoppades** — kräver slot-kapacitet som datalagret inte exponerar. Tre sanna
      tal slår ett uppfunnet fjärde; läggs till i B-01 när kapaciteten finns.
- [ ] **A-10** Mörkgrön `PortalSidebar` bort ur adminvärlden (personal-portalen rörs inte). Test: 0 träffar.
- [ ] **A-11** Verifiering: acceptanstest mot mockupen + tangentbord + 200 % zoom + mobil.
      Zivars testlista → `6-Testing/`. Goal → `2-Byggplan/klart/02-ytor/`.

## En sanning för tid (Zivars beslut 2026-07-14)

Motorn hade **två sanningar** om vad som är bokningsbart: härlett raster (arbetstid + längd + krock)
ELLER explicita `working_hour_slots` som *ersatte* det (opt-in, skrivna av `SlotManager`, 933 rader UI).
Kalendern och sajten kunde alltså visa olika luckor. Beslutet:

| Lager | Regel |
|---|---|
| **Tillgänglighet** (vad som ÄR ledigt) | EN sanning: arbetstid + tjänstens längd + bokningar + blockeringar. Gäller admin OCH sajt. |
| **Publikt raster** (vilka starttider KUNDEN erbjuds) | Valfritt. En salong kan lägga fasta starttider för självbokning — men det är en *presentationsregel*, aldrig en sanning om ledig tid. |
| **Adminkalendern** | Aldrig begränsad av det publika rastret. Ägaren bokar fritt i arbetstiden, 15-min snappning. |

Konsekvens i kod: `availability.ts` får veta vem som frågar. Publik fråga får honorera fasta starttider;
adminfrågan ignorerar dem alltid. `SlotManager` slutar vara schemasanning och blir (om den behålls)
enbart redigering av det publika rastret. `working_hour_slots` raderas aldrig — den slutar bara styra.

# L2 — Kalendern (här ligger hela värdet)

- [x] **B-01** *(2026-07-14)* Dataskikt: `staffDay()` (resurser + arbetstid, EN läsning) +
      `listBookings` per fönster + `listTimeOffOverlapping` (blockeringar). Lediga luckor kvar till B-12.
      Etiketter via `resolveTerm(terminology, 'staff', …)`.
- [ ] **B-02** Flyttbarhetsflagga på bokning (kunden valde specifik resurs vid självbokning ⇒ låst).
      Migration + backfill (befintliga = olåsta). Ett fält, ingen regelmotor.
- [x] **B-03** *(2026-07-14)* Tidsgeometrisk dagvy i `CalendarBoard.tsx`: y = starttid, höjd = längd,
      24h, nu-linje (bara på dagens datum), arbetstid vs skuggad ej-tillgänglig, stabil kolumnordning
      (`staff.created_at`). Krockande bokningar läggs **sida vid sida** — testad i `calendar-overlap.test.ts`
      (5 tester): en dold bokning är en missad kund.
      **Dessutom byggt: vecka + månad** — Zivars begäran. Ett arbetsbord, tre vyer, vy+datum i URL:en.
      **Fullskärm inbyggt:** ytan äger sin scroll (`.scroll`), sidan scrollar aldrig, toppnaven ligger kvar.
      **Responsiv:** `dvh` (mobilens adressfält klipper inte), kolumner med minbredd + horisontell scroll
      (alla resurser syns alltid), egen brytpunkt för liggande telefon.
- [x] **B-04** *(2026-07-14)* Blockering (`time_off`) = diagonalt mönster + ikon + orsakstext.
      Obekräftad/klar/avbokad bär ikon + text, aldrig färgen ensam. Identiteten är namnet.
- [x] **B-05** *(2026-07-14)* 15-min snappning: bunden i gridklicket (`onEmptyClick` snappar till
      `SNAP_MIN`) och i dragflytten. Skapa-vägens tider kommer ur slotmotorn (alltid giltiga).
- [x] **B-06** *(2026-07-14, komplett)* Vyval: ‹ Idag › · Dag/Vecka/Månad (radiogrupp) · period-stegning
      per vy · **resursfilter** (`?resurs=`, native select, bara vid >1 resurs) · **veckohopp "+4 v"**
      (ombokningshoppet — samma veckodag fyra veckor fram, dag- och veckovyn).
- [x] **B-07** *(2026-07-14)* Kalendern öppnar arbetsbordet direkt. Kiosken (`/admin/bokningar/vy`) —
      det andra systemet — är nu en omdirigering hit. Ingen mellanvy, ingen redirect till publika sidan.
- [x] **B-08** *(2026-07-14)* Enhetstester: överlapp/banor (`calendar-overlap.test.ts`), DST-väggklocka
      för serier (`block-series.test.ts`), avboka/återställ-semantik (`format.test.ts`), tel-länk
      (`tel-href.test.ts`), navgating (`admin-navigation.test.ts`). 948 tester gröna totalt.
- [x] **B-09** *(2026-07-14)* Realtid: `RealtimeBookings`-kanalen bär bookings + time_off (samma socket,
      500 ms debounce). Kanalen är en SIGNAL — data läses alltid om RLS-fencat server-side.
- [x] **B-10** *(2026-07-14)* Fyra tillstånd: normal · tom · tät · **fel**. Kalenderns kritiska läsningar
      KASTAR nu i stället för att svälja (`listBookings`/`staffDay`/`listServices`/`listTimeOffOverlapping`)
      — ett datafel får aldrig se ut som en tom kalender. `app/(admin)/error.tsx` fångar med Försök igen
      (riktig `reset()`, toppnaven kvar).

**Upptäckt under B-01…B-07 (2026-07-14):** kioskens "lediga tider" räknades ur `working_hour_slots`.
Fanns inga slot-rader visades **inga** lediga tider — därför kändes det aldrig som Wavy, där man ser hela
schemat. Kalendern räknar i stället ur arbetstid + bokningar + blockeringar. Slot-läget tas ur motorn i B-12.
- [x] **B-11** *(2026-07-14)* Bokningsdialog i `Modal` (Zivars beslut: centrerad dialog, INTE sidopanel
      — bottensheet <620px). Fokusfälla, Escape, fokusåterställning. Tangentbordsväg: Ny bokning-knappen
      → dialog → chips är riktiga knappar.
- [x] **B-12** *(2026-07-14)* Visa bokningsbar tid: vald tjänst ritar giltiga luckor som chips per resurs (adminDaySlots — arbetstid+bokningar+blockeringar+tjänstlängd, ALDRIG working_hour_slots). Ogiltiga luckor visas inte.
- [x] **B-13** *(2026-07-14)* Cellklick ärver datum/tid/resurs — ingen ominmatning. Klick utan tjänst → tjänstväljaren pekas ut.
- [x] **B-14** *(2026-07-14)* Kundkontrollen: ETT fält söker OCH skapar (searchCustomers, 250 ms debounce). Bara namn krävs. Dolda kunder träffas aldrig.
- [x] **B-15** *(2026-07-14)* Anteckning: intern notering i dialogen, markerad 'syns aldrig för kunden'.
- [x] **B-16** *(2026-07-14)* Notisval före spara: Skicka inget · E-post (SMS = disabled 'senare tillval'). Saknad adress = disabled MED förklaring; mejlet skickas PÅ RIKTIGT eller så sägs det ärligt.
- [x] **B-17** *(2026-07-14)* Spara = serverbekräftat via create_public_booking (samma RPC som kunden — alla vakter gäller). Aldrig optimistiskt.
- [x] **B-18** *(2026-07-14)* Befintlig bokning i samma dialog: tid/tz · resurs · kundlänk+RING (tel:) · tjänst+pris · anteckning · betalstatus (Stripe-speglad) · skapad-när.
- [x] **B-19** *(2026-07-14)* Handlingar: Flytta (drag MED förhandsvisning + explicit väg via ombokning) · Avboka · Markera klar/uteblev · Återställ (B-24). Statusknappar gatas på ALLOWED_FROM.
- [x] **B-20** *(2026-07-14)* Flytta-bekräftelse med konsekvenstext (från→till, person→person). Konflikt valideras av DB:ns EXCLUDE — originalet orört vid avslag.
- [x] **B-21** *(2026-07-14)* Konflikt: krock ger ärligt fel ('Tiden krockar…'), inmatning/bokning ligger kvar. Realtidskanalen speglar andras ändringar in i vyn.
- [x] **B-22** *(2026-07-14)* Blockeringsdialog: resurs+start förifyllda, 60 min default, orsak (chips + fritext), UPPREPNING: Aldrig/Varje dag/Vardagar/Varje vecka/Varannan/Årligen (materialiserad serie, series_id, 12 mån). KRÄVER migration 0061.
- [x] **B-23** *(2026-07-14)* Serieändring: 'Ta bort endast denna' / 'denna och alla framåt' på serieblock. Bakåt skrivs aldrig om. DST-väggklocka testad (block-series.test.ts).
- [x] **B-24** *(2026-07-14)* Ångralogg: ↩ i verktygsraden → Avbokade (30 dgr) med när+VEM (kund/verksamhet/system) + Återställ (via setBookingStatus: refund-vakt + krockskydd). Migration 0060 KÖRD i prod.
- [x] **B-25** *(2026-07-14)* Dölj kund (soft delete, hidden_at — historik kvar, 'Dolda kunder (N)' på Kunder-sidan) + 'Får boka själv'-toggle (self_book; vakt i kundflödet, ägaren opåverkad). KRÄVER 0061.
- [x] **B-26** *(2026-07-14)* Testbar logik extraherad + låst: avboka/återställ (cancellationTrace, restoreBlockedByRefund), serier (seriesOccurrences), överlapp, tel-länk. Fullstack-flödena täcks av klickbudget-e2e (B-27) mot staging.
- [x] **B-27** *(2026-07-14)* E2E-spec skriven: e2e/calendar-clickbudget.spec.ts (@mutating) — boka ≤5 klick, flytta = drag+bekräfta, avboka ≤3 + ångraloggkontroll. KÖRS PÅ STAGING (inte körd lokalt — @mutating-regeln).
- [x] **B-28** *(2026-07-14)* Kodsidan klar: focus-visible på block/knappar/select, prefers-reduced-motion, status aldrig enbart färg (ikon+text), radiogrupp för vyval. Ögon/enhetstest → A-11 (Zivars lista i 6-Testing/).

# L3 — Städ

- [ ] **C-01** Inställningarna grupperas i de nio kategorierna. Befintliga sidor mappas in — **ingen omdesign**.
      Varje inställning får exakt ett hem. Duplicerad sajtdata bort → länk till Redigera sidan.
- [ ] **C-02** "Redigera sidan" som huvudval: entry-yta (förhandskort + publiceringsstatus + "Öppna redigeraren").
      Editorn rörs inte. Ingen global "Publicera ändringar"-knapp som blandar drift och sajt.
- [ ] **C-03** Bokningsregler som begripliga lägen (På/Pausad/Av med konsekvenstext), inte råa flags.
- [ ] **C-04** Session verifierad: beständig inloggning, säker intern returväg, generiskt felmeddelande.
      Konto och säkerhet: lösenordsbyte, aktiva sessioner, logga ut andra enheter.
- [ ] **C-05** Wavy-migreringstest: de 9 uppgifterna, mät tid/beslut/fel/hjälpbehov (`6-Testing/`).
- [ ] **C-06** Presettest: samma kalendermotor mot minst två icke-frisörpresets. Noll kodforkar.
- [ ] **C-07** Frisörord ut ur admin-kod och hjälpcopy.
- [ ] **C-08** Städning: `BookingsClient`/`SlotManager`/`DropInColumn` avvecklade, avklarade goals →
      `2-Byggplan/klart/`, inga lösa filer, mapparna rena.

---

## Definition of done (varje punkt)

1. Mekanisk verifiering grön (acceptans-/enhets-/integrations-/e2e-test).
2. Oberoende verifierare för designtrohet — byggaren rättar inte sin egen läxa.
3. Tillgänglighet: tangentbord, synligt fokus, 200 % zoom, reduced motion, status aldrig bara färg.
4. Tenant-/rollgräns testad.
5. Zivars manuella testlista i `6-Testing/` avbockad.
6. Goal flyttad till rätt kategori i `2-Byggplan/klart/`.

## Senare beslut (blockerar ingenting)

SMS-tillval · TOTP-2FA · PWA för kund-admin · tillägg i bokning ("+ skäggtrim 15 min") ·
återkommande kundbokning ("boka om var 4:e vecka") · statistik/insikter.
