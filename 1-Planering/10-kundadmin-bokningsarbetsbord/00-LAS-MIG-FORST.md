# 10 — Kund-admin och bokningsarbetsbord

**Status:** PRODUKTRIKTNING LÅST med Zivar 2026-07-14.  
**Omfattning:** Kund-adminens informationsarkitektur, visuella skal, bokningsarbetsbord, inställningar, inloggning och notifieringsprinciper.  
**Inte ett goal:** Denna mapp beskriver vad som ska byggas och varför. Efter Zivars granskning tas ett exakt designunderlag fram i `4-Dokument-Underlag/`, därefter skrivs ett eller flera goals i `2-Byggplan/goals/`.

## Beskedet i en mening

Corevos kund-admin ska använda superadminens ljusa designspråk, öppna på en verksamhetsöversikt och ge bokningsverksamheter en fullständig kalenderarbetsyta där hela det dagliga bokningsarbetet kan utföras utan sidbyte.

Kortformen är:

> **Översikten är entrén. Kalendern är hela bokningsarbetsrummet. Inställningar är kontrollcentralen. Redigera sidan är den publika editorn.**

## Varför denna del finns

FreshCut-användaren är van vid Wavy Business. Det viktiga är inte Wavys grå utseende eller att hela Wavy består av en kalender. Det viktiga är att användaren mycket snabbt kan:

- se dagens bokningar och luckor;
- se vem som bokat, vilken tjänst som ska utföras och när den slutar;
- skapa en bokning med så få beslut som möjligt;
- hitta eller skapa kunden i samma flöde;
- flytta, ändra och avboka utan att lämna kalendern;
- blockera tid med samma mentala modell;
- nå sällaninställningar utan att de stör arbetsdagen.

Corevo ska bevara dessa arbetsresultat men samtidigt behålla sin större produktmodell: en generell plattform för flera branscher, flera moduler, betalningar, webbplats, roller och fler platser.

## De låsta produktbesluten

### 1. Kund-admin får samma designspråk som superadmin

Kund-adminen ska inte fortsätta med det nuvarande mörkgröna sidofältet och ett separat visuellt system. Den ska använda superadminens:

- ljusa, varma neutrala bakgrund;
- horisontella toppnavigation;
- typografi, knappar, kort, tabeller och statusmarkeringar;
- avstånd, radier, ramar och interaktionsmönster.

Det betyder samma visuella familj, inte samma roll eller samma innehåll. Superadmin styr hela plattformen. Kund-admin styr en verksamhet.

### 2. Översikt är startsidan efter inloggning

Användaren loggar in och ser direkt dagens viktigaste information. Kalendern ska inte ta över hela produkten och inställningar ska inte vara startsidan.

Översikten visar bland annat:

- dagens bokningar och nästa kunder;
- obekräftade eller ändrade tider;
- dagens personal-/resursläge;
- viktiga varningar eller uppgifter som kräver beslut;
- status för den publika sidan;
- en tydlig väg in i kalendern.

### 3. Kalender öppnar direkt det kompletta arbetsbordet

Toppvalet **Kalender** får inte leda till en mellanliggande dashboard eller en sida som skickar användaren vidare till den publika bokningssidan. Det ska direkt öppna den interaktiva kalendern.

I kalendern ska användaren kunna se, skapa, ändra, flytta, avboka och blockera utan att lämna arbetsytan. Den globala toppnavigationen finns kvar så att Översikt, Kunder, Redigera sidan och Inställningar alltid går att nå.

### 4. Kalendern är generell, inte frisörspecifik

Datamotor och komponenter byggs en gång. Preset och konfiguration avgör vilka ord och standarder användaren ser.

Exempel:

| Motorbegrepp | Frisör | Andra möjliga uttryck |
|---|---|---|
| resurs | frisör/personal | mekaniker, behandlare, rum, fordon, bord |
| tjänst | behandling | konsultation, reparation, aktivitet |
| bokning | kundbesök | uppdrag, sittning, klassplats |
| blockering | rast/frånvaro | reserverad, underhåll, ej tillgänglig |
| plats | salong | verkstad, klinik, lokal |

Det får inte skapas en separat frisörkalender eller kodgrenar av typen `if (frisör)`.

### 5. Inställningar blir en samlad kontrollcentral

Inställningar får en grund och stabil undernavigation:

1. Företag och profil
2. Personal och behörigheter
3. Tjänster
4. Öppettider och schema
5. Bokningsregler
6. Notiser och SMS
7. Betalningar och integrationer
8. Konto och säkerhet
9. Data, export och integritet

Användaren ska behöva ändra så lite som möjligt. Onboarding och branschpreset ska ge säkra standardvärden. Avancerade val visas först när de behövs.

### 6. Redigera sidan är en egen huvudfunktion

Corevos befintliga sajtbyggare är starkare än Wavys enkla Presentationsflik. Följande ska därför samlas under **Redigera sidan** och inte dupliceras i Inställningar:

- publika texter och bilder;
- kontaktuppgifter som visas på webbplatsen;
- visuell utformning och sektioner;
- bokningslänk och publik presentation;
- förhandsvisning och publiceringsstatus.

Inställningar kan länka till Redigera sidan men får inte skapa ett andra hem för samma data.

### 7. Inloggning förblir e-post och lösenord

Telefoninloggning och SMS-OTP införs inte. Målet är i stället:

- e-post och lösenord;
- en beständig och säker session så att användaren normalt loggar in en gång;
- valfri tvåfaktorsautentisering med autentiseringsapp/TOTP, inte SMS;
- kontroll över aktiva sessioner och möjlighet att logga ut andra enheter;
- ny verifiering för särskilt känsliga ändringar.

### 8. E-post är standardkanal; SMS är ett senare betalt tillval

Corevos pris ska inte behöva bära obegränsad SMS-trafik. I första byggfasen används e-post. SMS byggs senare som ett valbart, mätbart och fakturerbart tillval.

En verksamhet ska senare kunna välja exempelvis:

- inga SMS;
- endast påminnelser;
- bekräftelser och påminnelser;
- SMS vid ombokning/avbokning;
- personalnotiser vid nya bokningar.

SMS debiteras efter faktisk användning/SMS-del. Kunden ser användning, uppskattad kostnad och budgetgräns i admin.

### 9. Kontaktkrav beror på bokningens källa

- **Publik självbokning:** minst en kontaktväg krävs — e-post eller telefon.
- **Bokning skapad av personal:** endast kundnamn krävs; e-post och telefon är frivilliga.
- **Om båda finns:** e-post är standard för bekräftelse. En eventuell SMS-påminnelse styrs av verksamhetens tillval och bokningens notisval.
- **Om notis inte kan skickas:** UI ska säga det före spara. Bokningen får aldrig se ut att ha skickat ett meddelande som inte skickades.

## Målets toppnavigation

För en bokningsverksamhet är den initiala huvudnavigationen:

```text
Översikt · Kalender · Kunder · Redigera sidan · Inställningar
```

Navetiketter kan senare komma från preset, men de fem ansvarsområdena ska inte blandas ihop. Funktioner som bara är aktiva för vissa kunder ska inte skapa tomma eller döda ingångar.

## Vad vi tar från Wavy

- låg beslutskostnad i bokningsflödet;
- tidsgeometrisk dagvy och stabila resurskolumner;
- tjänst, pris och längd nära valet;
- kundsök och snabb ny kund i samma flöde;
- skapa, flytta, avboka och blockera i samma arbetskontext;
- tydliga standardvärden;
- domänspråk och konkret konsekvenscopy;
- sällaninställningar separerade från daglig drift.

## Vad vi inte kopierar från Wavy

- att hela produkten är kalendern;
- det gamla visuella uttrycket;
- oetiketterade ikoner och svag tangentbordsåtkomst;
- färg som enda identitetsbärare;
- svag rollstyrning och begränsad multi-location;
- att kunddata bara kan nås genom att starta en bokning;
- funktionella tak som Corevos befintliga motor redan har passerat.

## Avgränsning

Denna del beslutar produktens målbild. Den beslutar inte:

- exakta pixel-, font- eller färgvärden — de tas ur det kommande designunderlaget;
- exakt SMS-påslag eller fakturaintervall;
- leverantörsavtal för SMS;
- detaljerad goal-indelning eller kodfil-för-kodfil-plan;
- produktionsdeploy.

## Dokumenten i denna mapp

- `00-LAS-MIG-FORST.md` — besluten och dokumenthierarkin.
- `01-informationsarkitektur-och-adminskal.md` — hur kund-adminen hänger ihop.
- `02-kalender-och-bokningsfloden.md` — hela det dagliga arbetsbordet.
- `03-installningar-och-redigera-sidan.md` — vad som konfigureras var.
- `04-inloggning-kontakt-och-notiser.md` — session, 2FA, kontaktkrav, e-post och senare SMS.
- `05-syntes-code-codex.md` — vad analyserna var överens om och hur motsägelserna löstes.
- `06-byggordning-och-acceptans.md` — ordningen efter att denna design godkänts.

## Källor och företräde

1. Produktkanon: `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`.
2. Låsta beslut för denna del: denna mapp.
3. Konkurrentresearch: `3-Bakgrund-Research/WAVY-UX-ANALYS.md` och `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/`.
4. Kodnuläge: `5-Kod/`.

Research beskriver vad Wavy gör och varför det fungerar. Den styr inte Corevos produktarkitektur när den krockar med ett låst beslut här.
