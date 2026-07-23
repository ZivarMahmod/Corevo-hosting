# Visuell kanon — premiumdesign + verklig funktion

Fastställd av Zivar 2026-07-23.

## Huvudregel

`premium-v1/` är bindande för **hur kundportalens UI ska se ut**:

- färger och ytor;
- typografi;
- spacing, radier och skuggor;
- nästa-bokningens datumlockup;
- mobil dock och desktop-sidebar;
- responsiv placering;
- visuellt uttryck för kort, listor, dialoger och status.

Premiumprototypen är inte ett nytt produktkontrakt. Alla riktiga funktioner,
routes, säkerhetsregler, data och tillstånd i `SPEC.md`, `COMPONENTS.md`,
`COPY.md` och den befintliga implementationen ska behållas och kläs i den nya
designen.

## Verkliga funktioner som inte får tappas

- säker engångslänk och portalsession;
- återställning med kod på en ny webbläsare;
- kommande bokningar, historik och bokningsdetalj;
- neutral tenant- och ägarskapskontroll;
- avbokning och beständig återbetalning;
- kalenderexport;
- säker `Boka igen` till tenantens verkliga bokningsflöde;
- profil, namnändring och verifierat kontaktbyte;
- kontaktuppgifter, integritet och hjälp;
- säker utloggning;
- inloggade portalsessioner;
- PIN-fria bokningsenheter och återkallelse;
- PWA-installation och säker cache utan persondata;
- samtliga riktiga loading-, empty-, error-, offline- och sessionstillstånd.

Den befintliga portalnavigationen behålls:

1. Bokningar
2. Historik
3. Profil

Premiumdesignens visuella dock/sidebar används för dessa verkliga mål.

## Prototypfunktioner som inte ska implementeras

Följande finns endast som demonstrationsinnehåll i premiumprototypen:

- notifieringscenter, pushnotiser och oläst-räknare;
- intern ombokning inne i portalen;
- intern tjänste- och tidsväljare för ny bokning;
- lokal fyrsiffrig PIN som ”låser upp portalen”;
- prototypens fejkade salongs-, kund-, pris- och bokningsdata.

`Boka igen` och `Boka ny tid` fortsätter till tenantens riktiga publika
bokningsflöde. Portalåtkomst skapas av engångslänk eller recovery-kod, inte av
prototypens lokala PIN-knappsats.

## Kundsynlig copy som ska bort

Följande texter och motsvarande teknisk marknadsföring ska inte renderas i
produkten:

- `Lösenordsfri inloggning`
- `Lösenordsfri och säker`
- `Din lösenordsfria kundportal är redo`
- `PIN-koden låser upp kundportalen på den här enheten`
- `PIN-koden lämnar aldrig din enhet`
- versionscopy som `Corevo Portal · v1`

Säkerhetsfunktionerna finns kvar men namnges efter vad kunden faktiskt kan
göra:

- `Säkerhet och enheter`
- `Inloggade enheter`
- `PIN-fria bokningsenheter`
- `Logga ut`
- `Kräv PIN nästa gång`

## PIN-beslut

Den publika bokningens PIN är fyra siffror. Efter tre felaktiga försök måste
kunden begära en ny kod. Detta ändrar inte automatiskt portalens separata
recovery- och kontaktbyteskoder.

## Filhierarki vid konflikt

1. Senaste uttryckliga beslut från Zivar.
2. Denna fil.
3. `premium-v1/` för visuella värden och layout.
4. `SPEC.md`, `COMPONENTS.md`, `COPY.md` och `FEATURE-MATRIX.md` för verklig
   funktion, routes, copy, säkerhet och states.
5. Befintlig implementation där den redan uppfyller punkterna ovan.

`premium-v1/browser-window.jsx`, `ios-frame.jsx` och `support.js` är endast
förhandsvisningsramverk och ska aldrig flyttas in i produktkoden.
