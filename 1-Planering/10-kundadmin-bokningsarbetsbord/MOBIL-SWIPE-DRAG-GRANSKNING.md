# Kalender mobil — swipe vs. flytta bokning (granskning)

Zivars rapport: på mobil går det INTE att dra bokningar, och swipe-att-byta-dag är "helt galen". Granskning (jag + Codex) medan design gör en mobil/PWA-HTML-mock. Fix låses mot mocken när den landar i `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/`.

Fil: `5-Kod/apps/web/components/admin/CalendarBoard.tsx`.

## Root cause (två fel som tillsammans gör mobilen obrukbar)

### 1. Bokningsflytt = HTML5 drag-and-drop → fungerar INTE på touch
- Blocket (`BookingBlock`, rad ~1063) är `draggable={draggable}` med `onDragStart`/`onDragEnd`; kolumnen tar emot via `onDrop`/`onDropBooking` (rad ~449).
- HTML5 DnD (`dragstart`) syntetiseras **inte** från touch i mobila webbläsare (iOS Safari/Chrome Android). Alltså: **bokningar går aldrig att flytta med fingret** — bara med mus på desktop.
- Detta är kärnan i "de går inte dra bokningarna". Det är inte swipe som stjäl draget — det finns inget touch-drag alls.

### 2. Swipe-byt-dag lyssnar blint på scroll-containern
- `onTouchStart`/`onTouchEnd` på `.scroll` (rad 410–436): mäter bara dx/dy + scroll-kant. **Kollar aldrig om fingret startade PÅ ett bokningsblock.**
- Följd: varje tydligt vågrätt drag (≥70px, dx>1.8·dy) som inte är vid en scroll-kant läses som dag-byte. Ett försök att greppa/dra en bokning blir ett dag-byte → "helt galen".
- Dessutom: med 5 personalkolumner finns vågrätt scroll, så swipe triggar bara vid scroll-kanten idag — inkonsekvent beroende på scroll-läge.

## Fix-riktning (låses mot design-mocken)
1. **Touch-flytt av bokning** — pointer-baserat grepp: långtryck (`HOLD_MS`, samma mönster som `FreeArea` rad 855) på ett block "greppar", drag flyttar, släpp → SAMMA `pendingMove`-bekräftelsedialog som desktop. `setPointerCapture` för stabil spårning. Ingen ny skrivväg — återanvänd `moveBooking`.
2. **Grinda swipe:** på `touchstart`, om `e.target.closest('[data-block]')` (bokning/block) → markera "inte swipe". Undertryck även swipe medan ett grepp är armat/aktivt. Bara vågräta svep som startar på TOM yta (eller tidsaxeln) byter dag.
3. **Mobil-layout** (inväntar mock): 5 kolumner + swipe krockar med vågrätt scroll. Mocken avgör om mobil ska visa färre kolumner / en-person-vy där svep-byt-dag blir entydigt.

## Bevarande (döda inget)
- Desktop-musdrag ska funka kvar (draggable/onDrop orört, touch läggs additivt).
- `pendingMove`-bekräftelsen (flytt = medveten handling) behålls.
- Klick-bubblan (touch-klick på block → Ring/Öppna) får inte trigga av ett grepp — greppet måste avbryta bubbel-klicket (`e.detail`/pointer-flöde som `FreeArea`).

## Mocken svarar (Frisöradmin Mobil PWA.dc.html — landade i Dagens genomgångar)
Designen löser krocken genom att TA BORT den, inte finjustera den:
- **Mobil = EN-kolumn per frisör** (chips "en i taget", rad 54–61). Ingen flerkolumn → ingen vågrätt scroll → **swipe/‹ › = byt dag blir entydigt**.
- **Flytt sker via bottom-sheet, inte finger-drag på rutnätet.** Tryck på bokning → sheet med `Incheckning · Omboka · Avboka` (rad 239–244). "Omboka" = flytt-flödet på touch. Rutnätet behöver alltså INGEN touch-drag alls på mobil.
- Näst-kort överst, FAB `+` för ny bokning, tidsaxel 44px + 54px/timme.
- OBS: mocken är minbooking/personal-PWA:n ("MINBOOKING · DITT KONTO", bottennav Kalender/Min profil), inte /admin. Interaktionsmodellen (en-kolumn + sheet) är ändå svaret för den mobila kalendern.

## Reviderad fix (mot mocken)
1. **Mobil (≤~720px): en-kolumn-kalender** — visa en frisör i taget (chips), tidsaxel + en kolumn. Ingen vågrätt scroll.
2. **Svep/‹ ›= byt dag** blir säkert i en-kolumn-läget (ingen scroll-krock). Behåll pilar som primär, svep som bonus.
3. **Flytt på touch = "Omboka" i sheet/bubbla**, inte drag. Ingen långtryck-drag behövs → ingen gest-krock. Desktop-musdrag (draggable/onDrop) lämnas orört.
4. Grinda ändå swipe-handlern så den aldrig triggar av touch som startar på ett block (defensivt, om flerkolumn behålls i något läge).

## Öppet till Zivar (en fråga)
Ska /admin-kalendern på mobil byggas om till en-kolumn enligt mocken, ELLER är mocken minbooking-PWA:n som är ett EGET bygge (och /admin-mobilen får bara swipe-grindningen + en "Omboka"-knapp)? Scope skiljer sig stort.

---

## ⛔ SLUTGILTIGT (Zivar 2026-07-15) — överskriver sektionerna ovan
Två saker klarnade EFTER granskningen och gör minbooking-sektionerna ovan inaktuella:
1. **Rätt mock = ägar-admin, inte minbooking.** `01-agaradmin-mobil-pwa/` (referens `index-Kundadmin Responsiv.html`). Där är mobilen **alla 4 frisörer som kolumner, fit-to-width (ingen vågrät scroll)** — INTE en-kolumn.
2. **Paritetsprincip (Zivar): mobil = exakt desktop-funktioner, bara omplacerade. Inget nytt.** → Dagbyte = befintliga ‹ Idag ›-stegaren (finns på båda); längre hopp = befintliga **Månad-vyn** (tryck på datumet). INGA dag-chips (de var nytt → fel, reverterade). Ingen svep (mobil-eget → togs bort).

**KLART nu:** svep-byt-dag + dag-chips borta → dagbyte via stegaren/Månad, paritet med desktop. **Flytt på touch = "Omboka" i bokningens sheet** (Fas 3), desktop-drag orört. Resten av PWA:n = PAUSAD tills Zivar ger klarsignal.
