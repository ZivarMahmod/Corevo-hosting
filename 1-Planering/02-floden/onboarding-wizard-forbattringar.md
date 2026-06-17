# Onboarding-wizard — förbättringar (Zivars live-test 2026-06-15)

Zivar körde wizarden live (skapade en testkund, bransch nagelstudio, namn "Test Barber") och gav 5 synpunkter. Fångade här så de inte glöms. Blir en goal-brief (wizard v2) när de få design-besluten nedan är satta.

**Nuläge:** 6 steg — 1 Bransch · 2 Namn & subdomän (+ stad) · 3 Temamall · 4 Moduler · 5 Token-branding · 6 Ägare & roll. Skapandet är atomiskt (allt i ett svep). Preview finns idag BARA på tema-steget (steg 3).

## Synpunkter (Zivars ord, tolkade)
1. **Bransch känns som en bur.** Steg 1 förväljer mall + moduler per bransch. Texten säger "du kan ändra allt i nästa steg" — men det känns låst. → Branschen ska vara en *start*, inte ett lås. Gör friheten tydlig och faktisk.
2. **Steg 2 (namn & subdomän) är OK** men skulle kunna slås ihop med annat för att minska antalet steg.
3. **Temat är låst till branschen.** Steg 3 visar bara den branschens teman (nagel → Capiclean/Lumière/Polish/Linnea). Zivar vill kunna välja fritt bland ALLA teman, inte bara branschens. → Visa alla teman; rekommendera gärna branschens överst, men lås inte.
4. **Live-helsides-preview under HELA onboardingen (uttalat "ett måste").** Höger halva av skärmen är tom under alla steg. Den ska visa kundens RIKTIGA startsida live och uppdateras för varje val (bransch → tema → moduler → branding) så Zivar ser exakt hur sidan blir — särskilt hur modulerna ser ut i mixen med varandra. Idag finns preview bara på steg 3.
5. **Modul-lägena har fel kontext i wizarden.** Under SKAPANDE ska en modul bara vara Av / På (på = ingår). De fulla lägena (utkast / live / pausad) hör hemma EFTER att kunden skapats — i kundens admin, där man medvetet klickar pausa/live/av. → Enkelt i wizarden, fulla lägen i drift.

## Öppna design-beslut (kräver Zivar innan brief)
- **#2 — steg-ihopslagning:** vilka? T.ex. lägg tema-valet i samma vy som preview:n, eller slå ihop branding in i tema-steget.
- **#3 — temaval:** "alla teman valbara överallt" eller "alla, med branschens rekommenderade överst"?
- **#5 — wizard-lägen:** Av/På i wizarden. Default: booking = På (kärnmodul, kan ej stängas), övriga = Av. Stämmer det?

## Blir
Goal-brief "wizard v2" när besluten satta. Tyngsta biten = #4 live-helsides-preview (egen delleverans). #1/#3/#5 = mest UX/logik, lättare. Hör till Fas D (bredd/polish) i `2-Byggplan/ROADMAP-bryt-loopen-2026-06-15.md` — men kan lyftas tidigare eftersom det är själva multi-verktyg-känslan.
