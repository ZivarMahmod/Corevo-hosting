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

## Öppna frågor till mocken
- Ska mobil vara en-persons-kolumn (svep = byt dag entydigt) eller behålla flerkolumn + scroll?
- Långtryck-grepp vs. dedikerad "flytta"-knapp i bubblan (touch-vänligare, ingen krock alls)?
