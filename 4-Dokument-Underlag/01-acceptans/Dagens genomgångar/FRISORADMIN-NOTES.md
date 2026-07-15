# Frisöradmin (minbooking.corevo.se) — handoff-beskrivning

Fil: `Frisöradmin.dc.html` (interaktiv designprototyp, mörkt tema). Inloggad som FRISÖR (John) — samma designspråk och tokens som Kundadmin v2.

## ⚠ VIKTIGT till dig som kodar (Claude Code)
Designmockup — visar SKALET för frisörens roll. Ägare/platschef använder Kundadmin (booking.corevo.se) med allt; frisören loggar in på **minbooking.corevo.se** och får en nedskalad yta. Behörigheterna ska enforc:as SERVERSIDE — inte bara döljas i menyn. Vilka funktioner som exakt visas per frisör styrs av ägaren (Roller & behörigheter i Kundadmin → Inställningar): rollen FRISÖR + individuella tillägg (Ser alla kalendrar, Hanterar kundregistret, Ser dagens siffror, …).

## Princip
För frisören är kalendern allt. Ingen ekonomi, inga kunder-flikar, ingen sidredigering, inga företagsinställningar. Bara: min dag, (ev.) hela salongen, min profil.

## Struktur
1. **Toppnav**: salongslogga + "MINBOOKING · VIA COREVO". Endast två flikar: **Kalender** + **Min profil**. Höger: domän-chip `minbooking.corevo.se` + inloggad frisör (avatar med ring i frisörens färg + namn + mono-etikett FRISÖR). Ingen sök, inget platsfilter, ingen "Öppna min sida".
2. **Toolbar**: ‹ Idag ›, datum + personlig monorad ("v. 29 · 4 bokningar för dig · 1 klar · 1 avbokad · sista slutar 17:30"), segment **Min dag / Hela salongen**, `Blockera tid` + grön `+ Ny bokning`.
3. **Min dag (default)**: EN bred kolumn 09–18 med frisörens egna block (bredare block visar tidsintervall + kund + tjänst · min · kr). Ovanför: **NÄSTA-rad** — mono-klocka, kund (+NY KUND-chip), meta med ✆, countdown "om X min" (warn-gul <10 min), `Checka in` + `Visa`. Tom: "Inga fler besök idag."
4. **Hela salongen**: samma 4-kolumnsvy som Kundadmin Kalender v2 (kolumnhuvud med avatar/pass/antal, färg = frisör). Egen kolumn markerad med grön **DU**-chip + svagt tonad bakgrund. Kollegors block är READ-ONLY (ej klick/drag). Legendtext: "Du kan bara ändra dina egna bokningar."
5. **Interaktioner (egna bokningar)**: klick → chattbubbla (✆ Ring / Öppna) → bokningsdialog (identisk med Kundadmin: Checka in / Omboka / Avboka, avbokad = röd banner + Boka in igen). **Checka in är 2-stegs**: första trycket armerar knappen ("Bekräfta ✓", ljusare grön + ljus ram, Avbryt visas bredvid i NÄSTA-raden), andra trycket checkar in; återställs automatiskt efter 3,5 s — skydd mot misstryck. Dra & släpp flyttar TID (snap 15 min) — aldrig till annan frisör.
6. **Ny bokning / Blockera tid**: samma dialoger som Kundadmin men FRISÖR-fältet är LÅST till inloggad frisör — chip "John · du" + mono-not "Du bokar på din egen kalender" / "Gäller bara din kalender".
7. **Min profil** (ordning uppifrån): identitetskort (avatar, roll-chip FRISÖR, e-post/mobil, DIN FÄRG-prick) · **DIN BOKNINGSLÄNK** (mono-URL `freshcut.corevo.se/boka/john` + Kopiera-knapp → "Kopierad ✓" — frisören delar sin egen direktlänk i bio/stories) · **MINA PASS DENNA VECKA** (read-only, IDAG-chip, ⓘ "Schemat styrs av din chef") · **FRÅNVARO & LEDIGHET** (rader med status-chips GODKÄND/VÄNTAR + knappar `+ Ansök om ledigt` och röd `Sjukanmäl idag` — sjukanmälan blockerar dagens tider direkt och meddelar salongen; chefen godkänner ansökningar) · **MINA TJÄNSTER** (read-only rader namn + min · kr, ⓘ "styrs av ägaren") · **NOTISER** (toggles: SMS ny bokning PÅ, SMS avbokning PÅ, Dagsöversikt AV + rad "Synka till din mobilkalender" med Visa länk = ICS-prenumeration till Apple/Google) · **KONTO** (inloggnings-e-post, Byt lösenord + senast ändrat, Logga ut). Nederst streckad ⓘ-ruta: "Din chef kan ge dig tillgång till fler delar…".

## Behörighets-tweaks (props på komponenten — demo av ägarens rollstyrning)
- `seAllaKalendrar` (default PÅ): AV → segmentet "Hela salongen" försvinner, frisören ser bara Min dag.
- `kanSkapaBokningar` (default PÅ): AV → `+ Ny bokning` och `Blockera tid` försvinner ur toolbaren.
Samma mönster i skarp drift: ägarens toggles i Roller & behörigheter avgör vad som renderas (och vad API:t tillåter).

## Mobil / PWA
Fil: `Frisöradmin Mobil PWA.dc.html` (iPhone-ram, interaktiv). Detta är frisörens primära yta i vardagen.
- **Sidhuvud**: datum + personlig monorad, ‹ ›-pilar, avatar.
- **Frisörchips** (en kalender i taget på mobil): `Jag` + kollegor — kollegors dag är READ-ONLY (streckad banner "DU SER HILALS DAG · ENDAST LÄSLÄGE", inga tryck på block). Chipsraden försvinner om `seAllaKalendrar` är AV.
- **NÄSTA-kort** (bara egen dag): mono-klocka, kund, meta, countdown + 2-stegs `Checka in` + `Visa`.
- **Tidsgrid 09–18** en kolumn, nu-linje, breda block (tidsintervall · kund · tjänst · min · kr).
- **Tap på eget block → bottom sheet** (grabber, tid/tjänst/kund/✆ Ring/anteckning, 2-stegs Checka in / Omboka / Avboka; avbokad = banner + Boka in igen).
- **FAB `+`** nere till höger (döljs om `kanSkapaBokningar` AV) · **Bottennav**: Kalender / Min profil (44px-mål, safe-area-padding).
- **Min profil på mobil**: samma kort i komprimerad form (identitet, bokningslänk, pass, frånvaro med Ansök/Sjukanmäl, notiser, konto).

## Ägare/platschef på minbooking?
Nej — ägare & platschef loggar in på booking.corevo.se (Kundadmin, samma sida för båda med små synlighetsskillnader som styrs separat). Denna yta är enbart de anställdas.

## Tokens
Samma som övriga v2: bg `#121210` · yta `#1C1C18`/`#25251F`/`#2E2E28` · linje `#33332C`/`#4A4A41` · text `#F0F0EA`/`#C8C8BD`/`#96968C` · grön `#2F5F47` · ok `#9AC4A5` · warn `#D6AC6A` · röd `#D68F85`. Frisörfärger: Hilal `#8FB4E3`, John `#8FD6A6`, Ali `#5FC7B2`, Aziz `#C0A5F0`. Typ: Instrument Sans + IBM Plex Mono. Nu-linje 11:14, dag = onsdag 15 juli.
