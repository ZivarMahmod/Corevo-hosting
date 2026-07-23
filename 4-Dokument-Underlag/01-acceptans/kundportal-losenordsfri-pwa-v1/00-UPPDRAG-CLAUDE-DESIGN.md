# Uppdrag till Claude Design — säker länk in i kundportalen

## Vad vi bygger

Vi bygger den första vägen in i Corevos lösenordsfria kundportal:

**verifierad bokning → säker engångslänk → bokningsdetalj i webbläsaren**

Detta är inte en vanlig inloggning och kunden ska inte skapa ett konto eller
lösenord. Corevo är en generell flerbranschplattform; lösningen får därför inte
utformas som en frisörspecifik produkt.

Hela denna mapp är bindande designkanon. Läs samtliga filer innan du ändrar
eller skapar något. Improvisera inte nya färger, mått, texter, routes eller
funktioner.

## Kundflödet

1. Kunden slutför en publik bokning.
2. Kunden verifierar bokningen med en fyrsiffrig PIN.
3. Efter tre felaktiga försök låses den koden och kunden måste begära en ny.
4. Ingen godkänd PIN innebär ingen färdig bokning och ingen portallänk.
5. Efter godkänd PIN får kunden bokningsbekräftelsen via tenantens valda kanal:
   `sms_only`, `sms_with_email_fallback` eller `email_only`.
6. Bekräftelsen innehåller en säker engångslänk till
   `/oppna/[tenantSlug]#<token>` på kundportalens host.
7. När länken öppnas kontrolleras den neutralt. Hemligheten skickas med POST,
   tas omedelbart bort från adressfältet och skapar en portalsession i den
   webbläsare som öppnade länken.
8. Kunden skickas direkt till bokningen som skapade länken.
9. Därifrån kan kunden även se sina andra bokningar hos samma företag. En
   portalsession omfattar exakt en kund och en tenant.
10. När länken redan är förbrukad får den bara öppna bokningen direkt om samma
    webbläsare fortfarande har en giltig portalsession. En annan enhet, ett
    privat fönster eller en utgången session måste gå via ”Skicka ny kod”.

Den fyrsiffriga koden och tre försök gäller den publika bokningen. Detta uppdrag
ändrar inte ännu kodlängden för portalens separata recovery- eller
kontaktbytesflöden; följ befintlig kanon för dem.

## Den specifika designuppgiften

Designa och mekanisera följande sammanhängande del, i mobil och desktop:

- länken kontrolleras;
- giltig oanvänd länk och direkt övergång till rätt bokningsdetalj;
- förbrukad länk med giltig session;
- förbrukad länk utan session;
- felaktig, utgången eller återkallad länk som en gemensam neutral felyta;
- JavaScript saknas;
- bokningsdetaljen som kunden landar på;
- vägen från bokningsdetaljen till portalens bokningsöversikt.

Alla obligatoriska loading-, success-, error-, session- och responsiva states
ska hämtas ur `SPEC.md`, `COMPONENTS.md`, `COPY.md`, `TOKENS.md` och
`ACCEPTANCE-MATRIX.md`.

## Får inte byggas

- traditionell login, lösenord, social login eller kontoregistrering;
- en företagsväljare eller data från flera tenants i samma session;
- en länk som ger åtkomst innan bokningens PIN är godkänd;
- token, telefonnummer, e-post, kundnamn eller bokningsdetaljer på
  bootstrap-/felytan;
- token kvar i URL:en efter utbytet;
- en portalsession som delas automatiskt med andra enheter eller webbläsare;
- nya produktfunktioner utanför denna avgränsade del.

## Befintlig implementation att jämföra mot

- `5-Kod/apps/web/app/(customer-portal)/(open)/oppna/[tenantSlug]/`
- `5-Kod/apps/web/app/(customer-portal)/mina/bokningar/[id]/`
- `5-Kod/apps/web/components/customer-portal/OpenLinkExchange.tsx`
- `5-Kod/apps/web/components/customer-portal/PortalViews.tsx`
- `5-Kod/apps/web/app/(customer-portal)/portal.css`

Designkanon vinner om implementationen avviker.

## Leverans som ZIP

ZIP-filen ska innehålla källfiler, inte bara skärmbilder:

1. mobil-, desktop- och state-design för den avgränsade delen;
2. en kort ändringslista med exakt vilka kanonkrav som berörs;
3. mekaniska Playwright-acceptanstester (`*.accept.spec.ts`);
4. `probe.js` för exakta visuella värden och obligatoriska states.

Bevara följande målstruktur i ZIP-filen:

- designunderlag:
  `4-Dokument-Underlag/01-acceptans/kundportal-losenordsfri-pwa-v1/`
- mekanisk acceptans:
  `5-Kod/e2e/acceptans/kundportal-losenordsfri-pwa-v1/`

Ändra inte produktkoden. Codex granskar ZIP-filen mot kanon och implementerar
därefter den godkända designen lokalt.
