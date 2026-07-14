# 06 — Bransch-anpassning av kund-adminen (app/(admin))

> **Beslutsstatus 2026-07-14:** Kodkartläggningen och terminologigapen i denna FAS 0-research gäller fortfarande. Rekommendationer som bygger vidare på det mörkgröna globala sidofältet är ersatta av `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/codex/00-LAS-MIG-FORST.md`. Terminologiwiring ska genomföras inne i det nya ljusa kund-adminskalet, inte genom att permanenta det gamla skalet.

> FAS 0-research (2026-07-11). Kartlägger vad som REDAN bransch-anpassas i kund-adminen
> (booking.corevo.se), vad som saknas för att en nagelstudio/restaurang ska känna att
> adminen är byggd för dem, och vad som bäst styrs via bransch-kundbilden (rapport 02).
> Avgränsning: beteende/ord/vyer — inga nya moduler. Alla sökvägar relativa
> `5-Kod/apps/web/`.

## 1. Vad som redan finns — två fungerande mekanismer

### 1.1 Terminologi-overlayn (resolveTerm/termPlural)
- Motor: `lib/platform/verticals-shared.ts` — `resolveTerm` (rad 103), `termPlural` (rad 122),
  `cleanTerminology` (rad 82). Precedens: vertical-override → callsite-fallback → generisk
  default (`staff→Personal, service→Tjänst, unit→Resurs`, rad 73-77). Pluraler gissas ALDRIG
  — kräver explicit `<key>_plural` i `verticals.terminology`.
- Laddning: `lib/admin/tenant.ts:56-64` — `getAdminTenant` läser `verticals.terminology`
  som separat read (miss → `{}`, aldrig lockout) och exponerar `tenant.terminology` till
  varje admin-sida.
- Wirade ytor idag (alla enbart nyckeln **staff**):
  - `components/portal/PortalShell.tsx:153` — roll-etikett i sidofältet (`staff` → "Frisör").
  - `app/(admin)/admin/bokningar/page.tsx:223` → `BookingsClient` (`staffNoun`-prop: sök-placeholder
    rad 255, filter rad 304-306, tabellkolumn rad 453, detalj rad 1042).
  - `app/(admin)/admin/bokningar/vy/page.tsx:186` — kiosken ("Övriga (frisörer …)").
  - `app/(admin)/admin/scheman/page.tsx:61-62` — enda ytan som använder `termPlural`.
  - `app/(admin)/admin/personal/page.tsx:127` — `StaffRoster`-noun.
  - `app/(admin)/admin/kunder/page.tsx:136` och `kunder/[id]/page.tsx:112,186` — kolumn/fält.
- **Nyckeln `service` och `unit` konsumeras INTE av någon admin-yta idag** — bara `staff`.

### 1.2 Modulstyrd nav (tenant_modules)
- `components/portal/PortalSidebar.tsx` — `NAV.admin` (rad ~62-88): gruppen "Moduler"
  (media_library/shop/blogg/offert/lojalitet/presentkort) döljs per post via `module`-nyckeln;
  `PortalShell.tsx:120-128` hämtar `getAdminModuleStates` + filtrerar även ⌘K-paletten.
- Modulsidorna själva gate:ar också ("… är inte aktiverad för din salong", t.ex.
  `app/(admin)/admin/webshop/page.tsx:32`). Detta fungerar och är rätt modell — en
  nagelstudio utan webshop ser den aldrig.

## 2. Per admin-yta: OK / behöver bransch-variant / styrs via kundbilden

### 2.1 Skalet (layout, sidofält, topbar)
- **Generiskt OK**: modulgruppen, butik-väljaren (`PortalShell.tsx` LocationSwitcher),
  "Se din sida"-länken.
- **Behöver bransch-variant**:
  - `app/(admin)/layout.tsx:14` — `title="Salongsadmin"` hårdkodad; likaså `sub: 'Salong-admin'`
    i `PortalSidebar.tsx` och `metadata.title = '… · Salongsadmin'` på VARJE sida.
    En restaurang loggar in i "Salongsadmin" — värsta enskilda tellen.
  - Nav-etiketterna "Tjänster"/"Personal" (`PortalSidebar.tsx:69-71`) är hårdkodade och
    ikonen är `scissors` (sax!) för Tjänster — frisör-tell i varje bransch.
  - Fallback-texten "Ingen salong är kopplad till ditt konto" upprepas på ~12 sidor.
- **Via kundbilden**: ordet för verksamheten själv (ny terminologi-nyckel t.ex.
  `business: 'Salong'|'Studio'|'Restaurang'`) + ikon-val per bransch — data, ingen kodgren.

### 2.2 Dashboard (`app/(admin)/admin/page.tsx`)
- **Generiskt OK**: strukturen (hälsning, QuickActions, 4 KPI, Kommande idag, Topptimmar,
  Stripe-kort) passar alla bokande branscher; datat är bransch-neutralt.
- **Behöver bransch-variant**:
  - KPI 3 (rad 194-199): "Aktiva tjänster" med `icon="scissors"` + hint "X medarbetare i
    tjänst" — både ikon och båda orden ska genom `resolveTerm('service')`/`termPlural('staff')`.
  - KPI 4 (rad 200-205): "Nya lojalitetskunder" visas ÄVEN när lojalitet-modulen är av —
    KPI:erna bör modulgat:as precis som nav:en (restaurang utan lojalitet får en död nolla).
  - "Tjänste-mix"-kortet (rad 341) — rubrik via `termPlural('service')` ("Behandlings-mix",
    "Rätt-mix"…); samma för raden `b.serviceName · b.staffTitle` (rad 289) som är OK data
    men grid-etiketten ovanför är hårdkodad.
  - CTA "Boka åt kund på din sida" (rad 164) — verb per bransch ("Boka bord…") = terminologi.
- **Via kundbilden**: VILKA fyra KPI:er som visas (bransch-preset: restaurang vill se
  "Bord ikväll/no-shows", nagelstudio "återbokningsgrad") — en KPI-vallista per bransch i
  kundbilden, renderad ur samma `dashboardData`, ingen ny motor.

### 2.3 Bokningar + Bokningsvy-kiosken (`bokningar/`, `bokningar/vy/`)
- **Generiskt OK**: list-sidan är redan bäst wirad (staffNoun genom hela `BookingsClient`);
  kioskens mekanik (dag-bläddring, autorefresh, drop-in 2 tryck, slot-raster =
  `working_hour_slots`) är bransch-neutral och stark.
- **Behöver bransch-variant**:
  - Kioskens kolumn-grain är **per medarbetare** (`vy/page.tsx:239-250`). För nagelstudio
    rätt; för restaurang är kolumnen ett **bord/en enhet** — terminologi-nyckeln `unit`
    finns redan (default "Resurs") men används aldrig. Minsta väg: kolumnrubriken +
    "Övriga"-texten via `resolveTerm(unit|staff)`; på sikt att kolumn-källan (staff vs unit)
    blir bransch-parameter — men det är FAS 3 (beteende), inte denna rapport.
  - Drop-in-panelen (`DropInColumn.tsx`) förvalda tjänsten (`vy/page.tsx:106-109`) och
    dess ordval ("tjänst") — `service`-nyckeln in.
  - `metadata.title 'Bokningsvy · Salongsadmin'` (rad 21).
- **Via kundbilden**: default-tjänst/default-längd för drop-in, om lediga tider ska visas
  alls (restaurang: kapacitet snarare än slots), autorefresh-intervall.

### 2.4 Tjänste-fliken (`tjanster/page.tsx` + `components/admin/ServicesManager.tsx`)
- **Generiskt OK**: CRUD-mekaniken, storefront-förhandsvisningen, kategori-gruppering.
- **Behöver bransch-variant** — detta är den MINST wirade ytan, noll `resolveTerm`:
  - `tjanster/page.tsx:9` titel, `ServicesManager.tsx` rakt igenom: "Tjänster", "Ny tjänst"
    (rad 61-65), tabellkolumner `['Tjänst','Tid','Pris','Storefront','Online','']` (rad 95),
    toast "Tjänst skapad — nu bokningsbar på din sajt" (rad 422), tomläge (rad 86-89),
    "Tjänstemenyn" (rad 173). Allt ska ta `serviceNoun/servicePlural` som props precis som
    `BookingsClient` tar `staffNoun` — mönstret finns redan, det är ren wiring.
  - Fälten (namn/kategori/duration_min/pris) passar nagelstudio perfekt; restaurang bokar
    inte "45 min Klippning" — men fält-uppsättning per bransch är FAS 3-beteende. Ord-nivån
    ("Rätt"/"Sittning") går redan idag via terminologi.
- **Via kundbilden**: `service`/`service_plural`-orden, default-duration för ny tjänst,
  vilka kategorier som föreslås.

### 2.5 Scheman (`scheman/page.tsx`)
- **Generiskt OK**: bäst i klassen — `staffNoun` + `termPlural` (rad 61-62) redan inne,
  veckobräda delad med kiosken (`buildWeekBoard`), frånvaro, schemalås.
- **Behöver bransch-variant**: prosa-rester — "Schemat sätts per medarbetare" (rad 74),
  "Okänd medarbetare" (rad 121), "salongens tidszon" (rad 175), ledet rad 147 "Hela teamets
  vecka". Allt = samma noun genom befintlig `staffNoun`. För restaurang är schemat ändå
  personalens arbetstider → konceptet håller, bara orden.
- **Via kundbilden**: inget utöver terminologi; ev. default-slotlängd (FAS 3).

### 2.6 Kunder, Personal, Platser, Inställningar
- Kunder: wirad (`kunder/page.tsx:136`), MEN `kunder/CustomerExport.tsx:37` har hårdkodad
  CSV-header `'Frisör'` — miss i annars wirad yta.
- Personal: noun wirad (rad 127) men lede rad 100 säger "aktiv personal" hårdkodat +
  metadata/eyebrow "Salong-admin".
- Platser/Inställningar: "salong" i prosa överallt (`installningar/page.tsx:62,112,116,159`,
  `platser/page.tsx:31-32`) → `business`-nyckeln.

## 3. Sammanfattande gap-bild
1. **Ordet "salong" är plattformens defaultspråk** i chrome + metadata + tomlägen (~15 filer)
   — ingen terminologi-nyckel finns för verksamheten själv. Största "inte byggd för mig"-källan.
2. **Bara `staff`-nyckeln konsumeras.** `service` (finns med default) och `unit` (finns)
   är onyttjade; tjänste-fliken är helt owirad trots att prop-mönstret redan är etablerat.
3. **Dashboardens KPI:er är frisör-formade** (sax-ikon, lojalitets-KPI utan modulgate) men
   datalagret är neutralt — det är presentation, inte motor.
4. **Kiosken antar medarbetar-kolumner** — rätt för 4 av 5 verticals, fel för restaurang;
   ord-nivån fixas nu, kolumn-grain hör till FAS 3/rapport 03.
5. Terminologi-INNEHÅLLET per bransch (vad nagelstudio-verticalen faktiskt har i
   `verticals.terminology`) är superbookings ansvar → bransch-kundbilden (rapport 02) är
   rätt redigeringsyta: nycklar `staff/staff_plural/service/service_plural/unit/business`
   + KPI-val + kiosk-defaults per bransch, delade av alla tenants i branschen.

## Rekommenderad byggordning
1. **Ny terminologi-nyckel `business`** (+ `business_plural`) med default "Salong" → byt ut
   chrome/metadata/tomlägen (`layout.tsx`, `PortalSidebar.sub`, alla "Ingen salong…"-fallbacks,
   `installningar`/`platser`-prosa). Ren wiring, noll beteendeförändring för freshcut
   (fallback = dagens ord, `resolveTerm`-kontraktet garanterar det).
2. **Wira `service`-nyckeln i tjänste-fliken**: `tjanster/page.tsx` skickar
   `serviceNoun/servicePlural` till `ServicesManager` (samma mönster som
   `BookingsClient.staffNoun`), inkl. kolumnrubriker, CTA, toasts, tomläge. Ta dashboardens
   "Tjänste-mix"/"Aktiva tjänster" + boknings-radernas etiketter i samma svep.
3. **Städa staff-resterna**: `CustomerExport.tsx:37`, scheman-prosan (rad 74/121/147/175),
   personal-leden, kioskens drop-in-ordval.
4. **Dashboard-KPI:er**: (a) modulgate:a "Nya lojalitetskunder" (visa annan KPI när
   lojalitet ≠ live), (b) ikon + etikett via terminologi, (c) förbered KPI-val som
   bransch-preset (data i kundbilden, rapport 02).
5. **Fyll verticals.terminology per bransch i bransch-kundbilden** (superbooking): nagelstudio
   (`service: Behandling`, `staff: Nagelterapeut` …), restaurang (`service: Sittning`,
   `unit: Bord`, `business: Restaurang`) — så att steg 1-4 får verkligt innehåll.
6. **Kiosk-varianten för restaurang** (kolumn = `unit`, kapacitetsvy) — sist, eftersom det
   är beteende (FAS 3) och kräver rapport 03:s modulparametrar; ord-nivån är då redan klar.
