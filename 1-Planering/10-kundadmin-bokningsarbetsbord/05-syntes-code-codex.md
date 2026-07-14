# 05 — Syntes: Code-analysen och Codex-analysen

## Syfte

Två separata analyser har gjorts av Wavy Business:

- `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/claude/WAVY-UX-ANALYS.md` — djup liveanalys med exakta Wavy-flöden, klick, beteenden och medvetna produktbegränsningar;
- `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/codex/LIVE-ANALYS-OCH-FUNKTIONSPARITET.md` — Wavy jämfört med Corevos faktiska kod, multi-branschkrav, tillgänglighet och funktionsgap.

De konkurrerar inte. De har olika styrkor och ska användas tillsammans.

## Gemensam slutsats

Båda analyserna visar att Wavys viktigaste konkurrensfördel inte är utseendet. Den är att användaren kan utföra sitt vanligaste arbete med få beslut, stark kontext och mycket liten navigering.

Båda stödjer att Corevo ska:

- ha en tidsgeometrisk kalender med stabila personal-/resurskolumner;
- skapa bokning från den plats där datum, tid och resurs redan är kända;
- visa tjänst, längd och pris nära valet;
- kombinera kundsök och snabb ny kund;
- samla se, skapa, ändra, flytta och avboka i samma arbetskontext;
- hantera blockerad tid i samma kalenderlogik;
- visa notifieringskonsekvens innan spara;
- skilja daglig drift från sällaninställningar;
- använda Corevos visuella system och bättre tillgänglighet.

## Vad Code-analysen bidrar med

Code-analysen är starkast på Wavys faktiska mikrobeteenden:

- verifierade klicktal;
- behandling-först-flödet;
- giltiga luckor för vald behandling;
- drag-and-drop-flytt med exakt bekräftelse;
- stjärnans betydelse för om en bokning får flyttas mellan personal;
- återkommande blockeringar och serieändring framåt;
- 30 dagars återställningslogg;
- relativa veckohopp;
- mänsklig copy och säkra standardvärden;
- vilka funktioner Wavy medvetet valt bort för att hålla systemet litet.

Detta är huvudunderlaget när kalenderns arbetsflöden och acceptanskriterier specificeras.

## Vad Codex-analysen bidrar med

Codex-analysen är starkast på hur lärdomarna passar Corevo:

- verifierat kodnuläge i kund-adminen;
- vilka bokningsfunktioner som redan finns och vilka som verkligen saknas;
- skillnaden mellan superadminens och kund-adminens faktiska skal;
- Corevos multi-branschkanon och befintliga preset-/terminologimodell;
- tillgänglighet, roller, multi-location, betalstatus och säkra state transitions;
- att kalendern ska vara en universell motor, inte en salongsfork;
- att nytt bokningsarbete ska byggas direkt i det slutliga adminskalet;
- att Redigera sidan ska behållas som starkare ersättare för Wavys Presentation.

Detta är huvudunderlaget när produktarkitektur, byggordning och komponentgränser specificeras.

## Motsägelser och lösningar

### 1. “Hela produkten är kalendern”

**Code-observation:** Detta förklarar Wavys enkelhet och är korrekt för Wavy.

**Tidigare Codex-rekommendation:** Kalendern borde vara operativ startsida för bokningskunder.

**Zivars beslut:** Corevo ska öppna på Översikt. Kalendern ska vara hela arbetsytan först när användaren väljer Kalender.

**Lösning:**

> Kalendern är hela bokningsmodulen, inte hela Corevo-admin.

### 2. Dashboard eller kalender

Det är inte ett antingen-eller. Ytorna har olika jobb:

- **Översikt:** sammanfattar verksamheten, visar vad som kräver uppmärksamhet och ger tydliga ingångar;
- **Kalender:** genomför det operativa bokningsarbetet utan sidbyte.

Översikten får inte duplicera kalendern. Kalendern får inte bli en rapportdashboard.

### 3. Inställningar bakom kugghjul eller i huvudnavigation

Wavy kan gömma all administration bakom ett kugghjul eftersom produkten är liten. Corevo har fler riktiga verksamhetsytor.

**Lösning:** Inställningar är ett tydligt toppval. Inne i Inställningar används en grund och stabil kategorinavigation som bevarar Wavys igenkänning.

### 4. Presentation eller Redigera sidan

Wavy har en Presentationsflik med mobilpreview. Corevo har en verklig sajtbyggare.

**Lösning:** Redigera sidan ligger i huvudnavigationen. Inställningar duplicerar inte sajtdata. Förhandsvisning, utkast och publicering hör hemma i sajtbyggaren.

### 5. Ingen kassa eller betalning nära bokningen

Code-analysen såg Zettle-integrationen och drog slutsatsen att Wavy delegerar kassadomänen. Wavys nuvarande publika erbjudande innehåller också Wavy Checkout med betalning från aktuell bokning.

**Lösning:** Corevo behåller sin starkare betalningsmotor och betalstatus. Betalning kan visas nära bokningen när funktionen är aktiv, men den får inte belasta grundflödet för verksamheter som tar betalt på plats.

### 6. Wavys avskalning eller Corevos generella motor

Wavy vinner enkelhet genom att sakna bland annat avancerade roller, flera platser och separata kund-/schemaytor. Corevo har redan byggt flera av dessa förmågor.

**Lösning:** Ta inte bort fungerande Corevo-kapacitet. Göm den när den inte behövs och håll den utanför den korta bokningsvägen.

### 7. Telefoninloggning eller e-postinloggning

Wavy använder mobilnummer som en enkel kontoingång. SMS-baserad inloggning skulle ge Corevo en löpande kostnad och ytterligare missbruks-/återställningsyta.

**Lösning:** E-post och lösenord behålls. Beständig session ger “logga in en gång”-känslan. TOTP kan användas som valfri tvåfaktor utan SMS-kostnad.

### 8. SMS ingår eller faktureras

Wavy kan paketera SMS i ett pris per personal. Corevos planerade grundpris ska inte utsättas för obegränsad rörlig SMS-kostnad.

**Lösning:** E-post först. SMS senare som ett transparent, mätbart och fakturerbart tillval. Verksamheten väljer vilka händelser som ska använda SMS.

## Slutlig gemensam produktformulering

> Corevo ska ge Wavy-vana användare samma snabba arbetsresultat i kalendern, men inne i ett komplett och modernt verksamhetssystem. Översikten är entrén, kalendern är bokningsarbetsrummet, inställningar är kontrollcentralen och sajtbyggaren är den publika editorn.

## Hur analyserna delas i fortsatt arbete

Vid senare planering och implementation ska uppgifterna delas efter styrka:

- **Wavy-/Code-spåret:** arbetssekvens, klick, genvägar, Wavy-paritet och migreringstest;
- **Corevo-/Codex-spåret:** kodkoppling, universell datamodell, adminskal, tillgänglighet och systemsäkerhet;
- **gemensam verifiering:** varje byggdel jämförs både med det exakta designunderlaget och de låsta arbetsresultaten.

Ingen agent ska ensam improvisera om den andra sidan. Wavy-beteende utan Corevo-grund riskerar en salongsfork. Corevo-grund utan Wavy-beteende riskerar en korrekt men långsam produkt.
