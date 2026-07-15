# Kundadmin · Kalender v2 — handoff-beskrivning

Fil: `Kundadmin Kalender v2.dc.html` (interaktiv designprototyp, mörkt tema). Toppnav = samma chrome som Översikt v2.

## ⚠ VIKTIGT till dig som kodar (Claude Code)
Detta är en DESIGNMOCKUP — dialogerna är medvetet nedbantade för att visa stil/layout, INTE en spec på vilka fält som ska finnas. Befintlig funktionalitet får INTE tas bort:
- **Ny bokning**: behåll ALLA befintliga fält/steg (t.ex. tjänsteval från riktiga tjänstelistan med pris/längd, kundSök/befintlig kund, e-post, anteckning, betalsätt, sms-bekräftelse osv.) — applicera bara den nya visuella stilen (chips, mono-etiketter, inputs, grön primärknapp) på dem.
- **Blockera tid**: behåll befintliga alternativ (t.ex. heldag, återkommande, egen anteckning) — mockupen visar bara stilen.
- **Bokningsdialogen**: behåll all viktig kundinfo som finns idag (historik, e-post, bokningskälla, betalstatus m.m.) — det viktigaste ska synas först (tid, tjänst, kund, nummer, anteckning), resten får ligga under men försvinner inte.
Samma gäller övrigt: mockupen visar UX-mönster och tokens, inte en fullständig funktionslista.

## Princip
Så stilren som möjligt. Ingen bekräfta-funktion — en bokad tid ÄR bokad. Luckor är bara tomma ytor. Färg = frisör, alltid.

## Struktur
1. **Toolbar**: ‹ Idag › -pilar, datum + monorad (v. 29 · 12 bokningar · 62% · 1 avbokad), frisörfilter-chips (färgprick), Dag/Vecka/Lista, `Blockera tid`, grön `+ Ny bokning`.
2. **Kolumn per frisör**: huvud med avatar (ring + tonad bakgrund i frisörens färg), namn, passtider, antal idag. 2px-linje under huvudet i frisörens färg.
3. **Tidsgrid 09–18** (54px/h), tider i mono, gul nu-linje med klockstämpel.
4. **Bokningsblock**: bakgrund = frisörens färg 16% + 3px vänsterkant i full färg → tydligt vem, även perifert.
   - 30-min-block (smala): allt på EN rad — `12:00 · Marcus Lind · Fade` med ellipsis. Aldrig tomt/oläsligt.
   - ≥45 min: tid / kund / tjänst på egna rader + ✆-glyf uppe till höger om nummer finns.
   - Klar: nedtonad (op .42) + genomstruken. Paus/blockerad: diagonalrandig. **Avbokad: streckad röd ram + AVBOKAD-tagg, ligger kvar så ägaren har koll.**
5. **Klick på block → chattbubbla** (liten, med pil): `✆ Ring` (endast om kundens nummer finns) + `Öppna`. Paus-block har ingen bubbla.
6. **Öppna → bokningsdialog** (stilren, endast det viktiga): frisörprick + "hos X · idag", tid + tjänst, min · kr, kundrad (initialer, NY KUND-chip, nummer eller "Inget nummer angivet", Ring-knapp), ev. anteckning kursiv. Åtgärder: `Checka in` (grön) / `Omboka` / `Avboka` (röd). Avbokad bokning: röd banner "Avbokades idag 10:42 av kunden" + endast `Boka in igen`.
7. **Dra & släpp** (fungerar i prototypen): dra ett block till annan frisör och/eller ny tid — snappar till 15 min, målkolumnen tonas. Klara/avbokade block kan inte dras.
8. **Dialog Ny bokning**: tjänst-chips, frisör-chips (färgprick), datum + tid, kund + mobil (valfritt), `Boka in`.
9. **Dialog Blockera tid**: frisör-chips, från/till, anledning (Lunch/Möte/Privat), `Blockera`.

## Frisörfärger (uppdaterade, tydligare — används även i Översikt)
Hilal `#8FB4E3` · John `#8FD6A6` · Ali `#5FC7B2` · Aziz `#C0A5F0`. Blocktint = färgen på 16% opacitet.

## Kopplat till Översikt — ändringar som följer med denna leverans
När kalendern byggs om ska även Översikt-sidan (redan byggd från `Kundadmin Översikt v2.dc.html`) få dessa små ändringar:
1. **Nytt kort "Avbokningar"** i högerspalten (mellan Kräver uppmärksamhet och Genvägar): mono-rubrik AVBOKNINGAR + segmentväxlare `Idag / Vecka / Månad` (pill, aktiv = `#2E2E28`-bg). Innehåll: ENDAST antal (stor siffra) + summa i kr (mono, högerställd). Inget annat — ingen lista, inga grafer. Data hämtas per vald period.
2. **"Kräver uppmärksamhet"**: bekräfta/avböj-flödet borttaget (bokat är bokat). Avbokningar visas som info-ärende: röd prick + "Avbokning idag 15:30" + detalj (kund · tjänst · pris) + länk "Visa i kalendern →". Ingen åtgärdsknapp.
3. **Statuschips i Kommande idag**: OBEKRÄFTAD/BEKRÄFTAD finns inte längre — ersätts av källa: `ONLINE` (bokad via sidan, blå `#8FB4E3`) / `SALONG` (inlagd manuellt, grå `#96968C`).
4. **Frisörfärgerna uppdaterade** till de tydligare (Hilal `#8FB4E3`, John `#8FD6A6`, Ali `#5FC7B2`, Aziz `#C0A5F0`) — samma färger överallt: Översiktens tidslinje/listor OCH kalenderns block.

## PWA / responsivt (byggs med samma komponenter)
- **≥1200**: allt ovan.
- **iPad**: 2–3 kolumner, horisontell svep mellan frisörer; filterchips kollapsar till "Alla 4 ▾".
- **Mobil/PWA**: en frisör i taget (chips-rad överst), bokningsdialog = bottom sheet, `+ Ny bokning` = FAB nere till höger, chattbubblan oförändrad (Ring/Öppna). Safe-area insets, touch-mål ≥44px, nu-linjen autoscrollas in vid öppning.

## Tokens
bg `#121210` · yta `#1C1C18`/`#25251F`/`#2E2E28` · linje `#33332C`/`#4A4A41` · text `#F0F0EA`/`#C8C8BD`/`#96968C` · grön CTA `#2F5F47` · warn `#D6AC6A` · röd `#D68F85`. Typ: Instrument Sans + IBM Plex Mono. Radie: block 8, dialoger 18, chips 999.
