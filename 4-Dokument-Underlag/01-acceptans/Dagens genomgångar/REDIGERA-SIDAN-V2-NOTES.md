# Kundadmin · Redigera sidan v2 — handoff-beskrivning

Fil: `Kundadmin Redigera sidan v2.dc.html` (interaktiv designprototyp, mörkt tema). Toppnav = samma chrome som övriga v2-sidor.

## ⚠ VIKTIGT till dig som kodar (Claude Code)
Designmockup — visar UX-mönstret, INTE en komplett fältlista. Dagens redigerare har ett fält för i princip varje del av hemsidan (företagsnamn, färger med "Visa var", hero-rubrik/-ingress/om-text/mittenrubrik/"varför oss"-fält, bilder per sektion, kontakt/sociala medier, öppettider per dag, bokningsflikens fält osv). ALLA befintliga fält behålls och sorteras in i mönstret nedan — inget slimmas bort. Mockupen visar exempel på varje fälttyp.

## Grundbeslut
1. **Ett klick in.** "Redigera sidan" i toppnav öppnar redigeraren direkt — ingen mellansida.
2. **Kunden kan INTE byta mall och ordet "mall" syns aldrig i kundens admin.** Chips säger STANDARD / EGEN TEXT / EGEN FÄRG — aldrig mallnamn. Mallbyte görs av Corevo i superadmin.
3. **Panelen är mallstyrd.** Flikarna (= sidans delar) och deras kort byggs av mallens sektionsmanifest. Källa ger Allmänt/Hem/Behandlingar/Terapeuter/Om oss/Kontakt/Bokning/Apoteket/Anteckningar; Snitt ger Allmänt/Postern/Tjänster/Teamet/Galleriet/Kontakt/Bokning. Byts mall byts flikar + kort. (Testas i prototypen via Tweaks → mall.)
4. **Basfunktioner samma för alla mallar** (namn, färger, kontakt, öppettider, hämtad data), mallspecifika sektioner ovanpå. Samma motor, aldrig mallfork.

## Layout (fullskärm, ingen "ruta i ruta")
- **Rad 1**: toppnav (delad chrome).
- **Rad 2 — verktygsrad**: "Redigera sidan" + kundens adress · **flikarna inline** (aktiv = mörk pill + grön underkant) · statusprick (Osparat gul / Utkast gul / Live grön, full text i tooltip) · Dator/Mobil · Öppna live ↗ · **Spara utkast** · **Publicera**.
- **Utkast-banner** (visas bara när utkast finns): "Utkast sparat HH:MM — besökare ser fortfarande den publicerade versionen" + Publicera nu / Kasta utkastet.
- **Vänster 470px**: enbart redigeringskort för vald flik.
- **Höger**: förhandsvisningen fyller HELA ytan kant till kant (mobil-läget = 390px centrerad).

## Utkast & publicering (kärnflödet)
- Allt man ändrar är **förhandsvisning i realtid** — aldrig live direkt.
- **Spara utkast** = spara och kunna pausa/komma tillbaka utan att publicera.
- **Publicera** = utkastet går live.
- **Lämna-vakt**: navigerar man bort med osparade ändringar → dialog "Lämna redigeraren?" med tre val: Spara utkast & lämna (primär) / Kasta ändringarna / Stanna kvar. Med sparat utkast får man lämna fritt.

## Fälttyper (mönstret)
- **Textfält/textarea**: etikett i klartext ("Stora rubriken", "Texten under rubriken"), statuschip STANDARD (grå) / EGEN TEXT (gul), hjälptext under, **"Visa var"**-knapp som blinkar/markerar elementet i förhandsvisningen (bygg för ALLA fält).
- **Färger**: kurerade swatches ur sidans palett (aldrig fri färgväljare), EGEN FÄRG-chip, "Visa var". Primärfärgen slår igenom live i förhandsvisningen.
- **Bilder**: thumbs + Byt bild / Ta bort / +, "Egna bilder ersätter standardens".
- **Öppettider**: fält per dag, tomma dagar härleds ur personalens scheman (chip EGNA TIDER / FRÅN SCHEMAN).
- **Hämtad data (info-kort)**: tjänster/priser, team, betyg, blogg, butik redigeras ALDRIG här — ⓘ-förklaring + länk till rätt ställe ("Ändra under Inställningar → Tjänster"). En sanning per data.

## Förhandsvisning
Realtid på varje tangenttryck och toggle. URL-raden visar kundens riktiga adress + aktuell undersida (t.ex. /kontakt när Kontakt-fliken är vald — förhandsvisningen byter sida med fliken). Dator/Mobil-växlare. "Öppna live ↗" öppnar publicerade sidan.

## Att överväga i bygget (ej i mockupen — designa inte nytt, bygg funktionen)
- **Utkast är valbart**: finns ett utkast ska ägaren kunna öppna det och fortsätta, eller ta bort det (banner-knapparna "Publicera nu" / "Kasta utkastet" i mockupen är just detta).
- **Återställ till publicerad version** (ångra utkast) — naturlig kompis till utkastflödet.
- **Versionshistorik** (senaste publiceringarna, återställ).
- **Sidtitel & beskrivning för Google** (SEO-basics) under Allmänt.
- **Bildbeskärning/fokuspunkt** vid uppladdning.
- **"Visa var" på alla redigerbara fält** — mockupen visar mönstret på ett urval; i bygget får varje fält knappen (samma komponent, ingen ny design behövs).
- **Mobil admin-PWA**: flikväxel Panel/Förhandsvisning, Publicera fast i botten, touch ≥44px.

## Tokens
Samma som övriga v2: bg `#121210` · yta `#1C1C18`/`#25251F`/`#2E2E28` · linje `#33332C`/`#4A4A41` · text `#F0F0EA`/`#C8C8BD`/`#96968C` · grön `#2F5F47` · warn `#D6AC6A` · röd `#D68F85`. Typ: Instrument Sans + IBM Plex Mono (sidans egna typsnitt bara i förhandsvisningen).
