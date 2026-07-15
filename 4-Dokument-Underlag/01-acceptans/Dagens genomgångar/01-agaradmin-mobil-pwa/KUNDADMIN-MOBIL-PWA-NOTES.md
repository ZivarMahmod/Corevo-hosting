# Kundadmin · Mobil/PWA (ägare & platschef) — handoff-beskrivning

Fil: `index-Kundadmin Mobil PWA.html` (interaktiv designprototyp i iPhone-ram; kräver `support.js` + `ios-frame.jsx` bredvid).

## ⚠ VIKTIGT till dig som kodar (Claude Code)
Detta är SAMMA admin som desktop (booking.corevo.se) — ingen separat mobilapp, ingen egen kodbas. En sida som anpassar layouten efter viewport (se "Responsivitet" nederst — läs den noga, den är ett krav). Ägare och platschef ser samma yta; rollskillnader styrs separat. Befintlig funktionalitet får inte tas bort — mockupen visar mönster och stil.

## Skalet (från Universal toppbanner v2, mobilläget)
- **Topprad 52px**: Logo (F + FreshCut + VIA COREVO) · [flex] · Sök-ikon (öppnar globala Ctrl K-söket) · Avatar. INGA notiser/badges i toppraden.
- **Bottennav 5 slots**: Översikt · Kalender · **grön Ny bokning-FAB i mitten** (upphöjd, alltid nåbar med tummen) · Kunder · Mer. Safe-area-inset i botten, touchmål ≥44px.
- **Mer** samlar: Redigera sidan, Inställningar, Öppna min sida ↗, Mörkt läge (Auto/Ljus/Mörk — bor här på mobil, inte i toppraden), konto + Logga ut.

## Kalender (tjänan — viktigast)
Följer salongens invanda arbetssätt (deras nuvarande system visar alltid alla frisörer):
1. **ALLA 4 frisörer som kolumner samtidigt — även på mobil.** Ingen växling/chips. Kolumnerna blir bara smalare; innehållet i blocken anpassas i stället (se 4).
2. **Toolbar**: datum + monorad (v. 29 · 12 bokningar · 62% · 1 avbokad), ‹ Idag ›-stegare, ◔ Blockera tid.
3. **Dagsnabbval**: horisontell chip-rad (Idag · Tor 16 · Fre 17 …) — motsvarar deras +4/+5-hopp men med riktiga dagar. Snabbaste sättet att hoppa några dagar fram.
4. **Block per bredd**: desktop visar tidsintervall + kund + tjänst · min · kr; mobil (smal kolumn) visar starttid (mono) + kundnamn, tjänst bara på block ≥45 min. Färg = frisör alltid (tint 16 % + 3px vänsterkant). Klar = nedtonad + genomstruken · Paus = diagonalrandig · Avbokad = streckad röd ram + AVBOKAD.
5. **Nu-linjen** (gul, med klockstämpel) autoscrollas in vid öppning.
6. **Tap på block → chattbubbla** (✆ Ring / Öppna) **→ bottom sheet** med hela bokningen: tid, tjänst, min · kr, kund (NY KUND-chip, nummer, Ring), anteckning, **2-stegs Checka in** (tryck igen för att bekräfta, återställs 3,5 s) / Omboka / Avboka. Avbokad = röd banner + Boka in igen.
7. **FAB + → Ny bokning-sheet**: tjänst-chips, frisör-chips (färgprick), datum/tid, kund/mobil, grön Boka in. **◔ → Blockera tid-sheet**: frisör, från/till, anledning (Lunch/Möte/Privat).
8. Dra & släpp finns på desktop; på mobil är tap-flödet primärt (drag krockar med scroll).

## Översikt (mobil)
Härnäst-kort (countdown, 2-stegs Checka in, Visa → hoppar till kalendern och öppnar bokningen) · Idag i siffror (bokningar + progressbar, bokat värde + jämförelse, beläggning) · Kräver uppmärksamhet (avbokning som info-ärende, "Visa i kalendern →") · Avbokningar (segment Idag/Vecka/Månad → endast antal + summa).

## Kunder (mobil)
Sökfält + radlista (avatar-initialer, namn, mono-meta: besök/nästa/NY KUND/avbokade — avbokad röd, ny kund gul). Rad → kundkort (befintlig funktionalitet).

## ★ RESPONSIVITET — så ska sidan alltid "fatta" skärmen
**Principen: layouten styrs ENBART av layout-viewportens CSS-bredd. Aldrig av user agent-sniffning, aldrig av "är detta en telefon?"-logik.**

Brytpunkter (samma som Universal toppbanner v2):
- **≥1200 CSS-px → Desktop**: toppbanner med flikar, kalender med breda kolumner (tidsintervall + kund + tjänst i blocken), dialoger centrerade.
- **768–1199 → iPad**: banner 56px, sök→ikon, "Min sida ↗" kortad; kalendern behåller alla kolumner men blocken tappar tjänstraden på korta block; dialoger centrerade.
- **<768 → Mobil**: topprad 52px, flikar → bottennav + FAB, dialoger → bottom sheets, blocken visar starttid + kund.

Varför detta ger EXAKT beteendet Zivar beskrev:
1. **"Visa datorversion" i Samsung Internet/Chrome mobil**: webbläsaren sätter då en bred layout-viewport (~980–1280 px) i stället för device-width → sidan hamnar över 1200-brytpunkten → **desktoplayouten renderas automatiskt**. Kräver noll kod av oss — men BARA om vi aldrig UA-sniffar. Meta-taggen `viewport: width=device-width, initial-scale=1` ska finnas; "visa datorversion" åsidosätter den åt användaren.
2. **Webbläsarens egna zoom (menyn/Ctrl±, INTE fingernyp)**: browser-zoom ändrar CSS-viewportens bredd (zoomar man IN blir viewporten SMALARE i CSS-px). Desktop på 125–150 % zoom → under 1200 → **iPad-läget**; fortsätter man zooma in → under 768 → **mobil-läget med bottennav**. Zoomar man ut går det åt andra hållet. Detta följer automatiskt av media queries på width — inga JS-lyssnare behövs (JS får läsa `matchMedia`, aldrig egna pixelhack).
3. **Fingernyp (pinch)**: ändrar BARA visual viewport, INTE layout-viewporten → layouten ska INTE byta läge när man nyper. Rör inte pinch: inga `touch-action`-hack, ingen `user-scalable=no` (tillgänglighetskrav).
4. **Fönster-resize/split screen på surfplatta**: samma media queries täcker det — drar man Samsung DeX/split-screen smalare byter sidan läge live.

Implementation: en komponentuppsättning + CSS-brytpunkter (media queries / container queries för kalenderkolumnerna). Kalenderns kolumner är alltid `repeat(4, 1fr)` — det som ändras per bredd är blockens innehållsnivå och chrome (banner ↔ bottennav). Testa: 1440px, 1024px, 390px, desktop-läge på mobil, 150 % zoom på desktop, pinch (får inte byta läge).

## Tokens
Samma som alla v2: bg `#121210` · yta `#1C1C18`/`#25251F`/`#2E2E28` · linje `#33332C`/`#4A4A41` · text `#F0F0EA`/`#C8C8BD`/`#96968C` · grön `#2F5F47` · ok `#9AC4A5` · warn `#D6AC6A` · röd `#D68F85`. Frisörfärger: Hilal `#8FB4E3`, John `#8FD6A6`, Ali `#5FC7B2`, Aziz `#C0A5F0`. Typ: Instrument Sans + IBM Plex Mono. Inga synliga scrollbars i appytorna.
