# 01 — Informationsarkitektur och adminskal

## Mål

Kund-adminen ska kännas som samma produktfamilj som Corevos superadmin, men vara optimerad för verksamhetsägaren. Användaren ska alltid förstå:

- var den befinner sig;
- vad som är viktigast just nu;
- var dagens arbete utförs;
- var sällaninställningar finns;
- hur den kommer tillbaka utan att tappa kontext.

## Grundstruktur

```text
Kund-admin
├── Översikt
├── Kalender
├── Kunder
├── Redigera sidan
└── Inställningar
    ├── Företag och profil
    ├── Personal och behörigheter
    ├── Tjänster
    ├── Öppettider och schema
    ├── Bokningsregler
    ├── Notiser och SMS
    ├── Betalningar och integrationer
    ├── Konto och säkerhet
    └── Data, export och integritet
```

## Toppnavigation

Desktop använder en horisontell toppnavigation enligt superadminens nya design. Den ska innehålla:

1. verksamhetsidentitet;
2. de fem huvudvalen;
3. global sök/kommandopalett när funktionen finns;
4. platsväljare när verksamheten har fler än en plats;
5. tema-/visningskontroll där den är relevant;
6. konto-/profilmeny;
7. tydlig länk till den publika sidan.

Det mörkgröna permanenta sidofältet tas bort från kund-adminen. Underordnad navigation kan finnas inne på en yta, exempelvis kategorierna i Inställningar, men den ska inte skapa ett andra globalt skal.

## Visuellt förhållande till superadmin

### Ska vara gemensamt

- toppskalets komposition;
- ljus varm grund;
- typografisk hierarki;
- kort, tabeller, badges och knappar;
- sök, menyer, dialoger och drawers;
- fokus-, hover-, laddnings-, tom- och feltillstånd;
- responsiva brytpunkter och tillgänglighetsnivå.

### Ska vara rollanpassat

- logotyp/namn visar verksamheten och Corevo-relationen, inte “Superadmin”;
- navigationen visar verksamhetsuppgifter, inte plattformsfunktioner;
- kund-admin ser endast sin tenant och sina tillåtna funktioner;
- superadminens cross-tenant-kommandon får aldrig läcka in.

## Översikt

Översikten är en startyta, inte en kopia av kalendern. Den ska besvara:

- Vad händer idag?
- Vad kräver min uppmärksamhet?
- Vad är nästa naturliga handling?
- Är min publika sida och bokning öppen?

### Primärt innehåll

- datum och verksamhetskontext;
- dagens bokningsantal och nästa besök;
- kommande idag i kompakt lista;
- obekräftade, ändrade eller problematiska bokningar;
- personal-/resursstatus idag;
- tydlig primär knapp till Kalender;
- tydlig länk till den publika sidan;
- viktiga konfigurations- eller driftvarningar.

### Sekundärt innehåll

- enkel veckoöverblick;
- tjänste-/bokningsmix;
- publiceringsstatus;
- betal-/integrationsstatus när relevant.

### Ska inte ligga på Översikt

- full dagkalender;
- alla inställningsfält;
- sällananvänd konfiguration;
- döda KPI:er för funktioner kunden inte har;
- flera konkurrerande knappar som utför samma sak.

## Kalender

Kalender är den operativa arbetsytan. Klick på huvudvalet ska gå direkt till arbetsbordet. Befintlig listvy kan finnas som ett sekundärt vyval inne i Kalender, men får inte vara ett hinder före dagkalendern.

## Kunder

Kunder är en egen yta eftersom Corevo ska stödja fler arbetsuppgifter än att hitta en kund mitt i en bokning. Den ska samtidigt vara tillgänglig inifrån kalenderns bokningsdrawer.

## Redigera sidan

Redigera sidan öppnar sajtbyggaren. Den ska vara ett huvudval eftersom “min publika sida” är en central Corevo-förmåga och en tydlig differentiering mot Wavy.

## Inställningar

Inställningar är en yta med egen lokal kategorinavigation. Den globala toppnavigationen ligger kvar. Byte mellan inställningskategorier ska inte kasta ut användaren ur Inställningar.

## Mobil och mindre skärmar

Det horisontella skalet ska inte tryckas ihop till oläsliga länkar. På mindre skärmar ska:

- huvudnavigationen bli en tydlig meny eller kompakt växlare;
- aktuell yta alltid vara namngiven;
- de viktigaste handlingarna vara nåbara med en hand;
- kalendern använda en resurs i taget eller ett valt resursurval;
- inga viktiga funktioner vara beroende av hover;
- inzoomning upp till 200 procent fungera utan förlust av handlingar.

## Behörighet och synlighet

Navigation är inte en säkerhetsgräns. Varje route och mutation behåller server-/RLS-skydd. UI visar bara det användaren har rätt att använda, men dolda länkar ersätter aldrig riktig auktorisering.

Funktioner som inte är aktiverade ska inte visas som tomma toppval. För den första bokningskunden behandlas Kalender som en normal och permanent huvudfunktion. Den tekniska aktiveringen får inte skapa märkbar osäkerhet i navigationen.

## Systemtillstånd

Alla ytor ska ha explicita tillstånd för:

- laddar;
- tomt;
- fel;
- sparar;
- sparat;
- opublicerade ändringar;
- publicerat/live;
- offline eller osäker anslutning där det är relevant.

En handling får aldrig se sparad, publicerad eller skickad ut innan servern har bekräftat det.
