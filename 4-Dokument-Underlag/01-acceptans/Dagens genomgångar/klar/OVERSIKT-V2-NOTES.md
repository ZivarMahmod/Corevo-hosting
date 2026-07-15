# Kundadmin · Översikt v2 — handoff-beskrivning

Fil: `Kundadmin Översikt v2.dc.html` (statisk design, mörkt tema). Toppnav oförändrad.

## Idé
Gamla sidan: tre stora KPI-kort + två nästan tomma band → mycket död yta.
Nya sidan: tvåkolumnslayout. Vänster = "vad händer nu" (operativt), höger = "läget + att göra" (siffror, inkorg, genvägar).

## Struktur
1. **Sidhuvud**: mono-eyebrow (datum · platsfilter), H1 = hälsning ("God morgon, {namn}"), statusrad i klartext ("12 bokningar idag · 5 klara · nästa om 18 min"). Höger: sekundär `+ Ny bokning` + primär grön `Öppna kalendern` (flyttad upp från Dagens schema).
2. **Härnäst (hero, vänster)**: nästa besök stort — mono-klocka 40px, tjänst, kund (+ NY KUND-chip), medarbetare (färgprick), längd, pris. Countdown "om X min". Knappar: `Checka in`, `Visa bokning`. Högerdel av kortet: "Därefter" = 3 nästkommande rader + länk "Alla N kvarvarande". Ersätter gamla "Nästa besök"-kortet.
3. **Dagens schema (tidslinje)**: en rad per medarbetare (prick + namn + passtider i mono), spår 09–18 med absolut positionerade block: bokad (grå, 3px vänsterkant i medarbetarfärg), klar (55% opacity + genomstruken), paus (diagonalrandig), nästa besök (grön, highlight). Gul vertikal **nu-linje** över alla rader. Legend uppe till höger. Ledig personal = kursiv tom rad. Ersätter gamla personkorten "Inga fler tider idag".
4. **Kommande idag**: kompakt tabell (tid mono · kund · tjänst · medarbetare · statuschip BEKRÄFTAD/ONLINE/OBEKRÄFTAD) + länk till kalendern.
5. **Idag i siffror (höger)**: gamla tre KPI-korten ihopslagna till ett kort med tre rader: bokningar (progressbar klara/kvar), bokat kr (+jämförelse mot förra onsdagen), beläggning % (bar). Mindre yta, samma info.
6. **Kräver uppmärksamhet (höger)**: inkorg med räknar-badge. Varje ärende = prick (warn/bad) + titel + detalj + inline-åtgärder (`Bekräfta`/`Avböj`, `Fyll luckan`). Tomt läge: en rad "Inget kräver din uppmärksamhet." — inte ett stort band.
7. **Genvägar (höger)**: 2×2 tysta knappar — Ny bokning, Blockera tid, Ny kund, Påminnelser.

## Tokens (samma som Corevo admin, mörkt)
bg `#121210` · kort `#1C1C18` · upphöjt `#25251F` / `#2E2E28` · linje `#33332C` / `#4A4A41` · text `#F0F0EA` / `#C8C8BD` / `#96968C` · grön CTA `#2F5F47` (text `#E9F2EC`) · ok `#9AC4A5` · warn `#D6AC6A` · bad `#D68F85` · info `#A2B6D0`.
Typ: Instrument Sans (UI) + IBM Plex Mono (tider, etiketter, chips). Radie: kort 16, knappar 9–10, chips 999.
Medarbetarfärger: Hilal `#A2B6D0`, John `#9AC4A5`, Ali `#7FC0B4`, Aziz `#B9A6D6`.

## Tillstånd
- Tom dag: hero visar "Inga bokningar idag" + knappar Ny bokning/Blockera tid; tidslinjen behålls (visar pass); siffror visar 0.
- Nu-linje: position = (klockan − 09:00) / 9h i procent av spårbredden; visas bara 09–18.
- Countdown < 10 min → tid i warn-gult.
