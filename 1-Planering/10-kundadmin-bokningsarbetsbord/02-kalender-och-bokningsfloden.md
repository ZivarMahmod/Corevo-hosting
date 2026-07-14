# 02 — Kalender och bokningsflöden

## Syfte

Kalendern ska vara Corevos kompletta operativa arbetsbord för verksamheter som arbetar med tider, resurser och kunder. Användaren ska inte behöva lämna kalendern för att genomföra eller rätta det vanligaste arbetet.

Det betyder inte att kalendern är hela Corevo. Den är hela arbetskontexten när användaren befinner sig i Kalender.

## Vad kalendern ska visa direkt

Utan att öppna en bokning ska användaren kunna se:

- vald dag och vecka;
- plats;
- personal/resurser;
- arbetstid och ej tillgänglig tid;
- lediga luckor;
- bokningens start och slut;
- kund eller bokningsobjekt;
- tjänst/behandling;
- bokningsstatus;
- skillnaden mellan bokning och blockering;
- relevant varning, exempelvis obekräftad bokning.

## Geometri

- Tid löper vertikalt.
- Personal/resurser ligger i stabila kolumner.
- Ett objekts position visar starttid.
- Ett objekts höjd visar varaktighet.
- Bokning och blockering skiljs med mer än bara färg, exempelvis text, ikon eller mönster.
- Personal-/resursidentitet bärs av namn och struktur; färg får endast förstärka.

## Huvudflöde: skapa bokning

Den rekommenderade sekvensen kombinerar Wavys behandling-först-princip med kalendercellens starka kontext:

1. Användaren väljer tjänst eller klickar en ledig kalendercell.
2. Systemet behåller känd kontext: datum, starttid, plats och resurs.
3. Tjänstens standardlängd och pris visas och fylls i.
4. Endast giltiga luckor/resurser för valet erbjuds.
5. Användaren söker fram befintlig kund eller skriver klart en ny kund i samma kontroll.
6. Notisraden visar exakt vad som kommer skickas eller att inget skickas.
7. Användaren sparar.
8. Kalendern uppdateras och visar bekräftad serverstatus.

Systemet ska fråga efter det som inte redan kan härledas. Datum, tid och resurs ska inte matas in igen efter klick i en cell.

## Kundsök och snabb ny kund

Sök och nyregistrering ska vara ett sammanhängande flöde:

- skriv namn, e-post eller telefon;
- visa matchningar om de finns;
- om ingen rätt träff finns, använd samma inmatning för ny kund;
- namn är enda obligatoriska fältet vid personalbokning;
- e-post och telefon är frivilliga men deras notifieringskonsekvens visas;
- möjlig dubblett ska varnas före ny kund skapas.

## En gemensam bokningsdrawer

Samma huvudyta ska användas för att skapa, läsa och rätta. Den kan byta läge men ska behålla samma struktur och placering.

### Visar

- datum, start, slut och tidszon;
- plats och personal/resurs;
- kunduppgifter;
- tjänst(er), längd och pris;
- intern anteckning och eventuell kundsynlig information tydligt separerade;
- bokningskälla och historik;
- notifieringar och leveransstatus;
- betalstatus när betalningsfunktionen är aktiv.

### Handlingar på befintlig bokning

- Ändra kund, tjänst eller anteckning.
- Flytta tid.
- Flytta mellan tillåtna resurser.
- Avboka.
- Markera uteblev/genomförd när rollen får det.
- Se historik.
- Skicka tillåten notis manuellt.

## Flytta bokning

Drag-and-drop kan vara en snabbväg på desktop men får inte vara den enda vägen. Tangentbord och touch ska kunna använda en explicit Flytta-funktion.

Före bekräftelse ska systemet skriva konsekvensen konkret:

```text
Flytta Herrklippning för Anna Andersson
från tisdag 10:00 hos John
till tisdag 11:00 hos Aziz?
```

Konflikt kontrolleras mot serverns aktuella data före flytten slutförs. Vid konflikt ligger ursprungsbokningen kvar orörd.

## Avboka och återställa

Avbokning sker från bokningsdrawern utan sidbyte. Systemet ska:

- beskriva vilken bokning som avbokas;
- visa om någon notis skickas;
- behålla historik och källa;
- frigöra tiden först efter bekräftad servermutation;
- visa ångra/återställ när domänregler och efterföljande bokningar tillåter det;
- hantera eventuell betalning/退款 som ett separat tydligt tillstånd, aldrig tyst.

## Blockera tid

Blockering skapas i samma kalenderkontext som bokning:

1. välj Blockera tid;
2. välj cell eller tidsintervall;
3. resurs och start är förifyllda;
4. ange orsak/beskrivning;
5. välj eventuell upprepning;
6. spara.

Stöd ska finnas för enkel och återkommande blockering. Serieändringar ska uttryckligen skilja mellan denna instans och framtida instanser. Historik får inte skrivas om tyst.

## Vyval och navigation

Minimikrav:

- idag;
- föregående/nästa dag;
- datumväljare;
- dagvy;
- veckovy eller kompakt veckoöversikt;
- platsväljare;
- resursfilter;
- snabb hoppning flera veckor framåt där branschens ombokningsmönster motiverar det.

Listvy kan finnas som sekundärt alternativ för sök, export och kompakt administration.

## Realtid och fel

Kalendern ska hantera att flera personer arbetar samtidigt:

- synkronisera bekräftade förändringar;
- servervalidera krockar;
- aldrig lova bokning innan servern bekräftat den;
- visa vem/vad som ändrats om en konflikt uppstår;
- behålla användarens inmatning när ett återförsök är säkert;
- inte låtsas fungera offline.

Notifieringsfel får inte radera en giltig bokning. Bokningens status och notisens status visas separat.

## Tillgänglighet

Kärnflödena ska fungera med:

- tangentbord;
- synligt fokus;
- Enter/Space för kontroller;
- Escape och korrekt fokusåterställning för drawer/dialog;
- 200 procent zoom;
- skärmläsarbegripliga namn för bokningar och tider;
- reduced motion;
- status som inte uttrycks enbart med färg.

## Mobil

Mobil ska inte vara en krympt fyrkolumnskalender. Grundmodellen är:

- vald dag;
- en resurs eller ett valt team i taget;
- snabb resursväxling;
- tydlig tidslinje;
- stor primär handling;
- drawer som blir helskärm;
- explicit Flytta-funktion i stället för beroende av drag-and-drop.

## Mätbara resultat

1. En inloggad användare når dagens kalender med ett klick från Översikt.
2. Kalendern öppnas direkt utan mellanliggande bokningsdashboard.
3. Datum, tid och resurs behöver inte matas in efter klick i en cell.
4. Befintlig kund kan bokas utan ny kundregistrering.
5. Ny kund kan skapas i samma flöde.
6. Notisens kanal och konsekvens visas före spara.
7. Ändra, flytta, avboka och blockera sker utan sidbyte.
8. Bokning och blockering kan skiljas utan färg.
9. Konflikt lämnar ursprungsdata intakt.
10. Samma motor kan visas med terminologi för minst tre branscher utan kodfork.
