# Zivar Graph Studio 3D

## Syfte

Ersätt den valbara 2D-kartan med en enda roterbar 3D-graf där verkliga
Graphify-noder formar en hjärnlik struktur. Formen är ett navigationssätt,
inte en anatomisk modell.

## Vyer

- A och B visar respektive projekt som en full 3D-hjärna.
- Båda visar som standard A i vänster halva och B i höger halva.
- Ett separat läge visar två fulla hjärnor bredvid varandra.
- Diff använder samma geometri och befintlig ändringsklassificering.
- Communities bildar stabila regioner och noder ligger stabilt mellan omladdningar.

## Interaktion

- Dra eller använd ett finger för att rotera.
- Scrolla eller nyp för att zooma.
- Klicka för nodinformation och dubbelklicka för grannskap.
- Återställ kamera, automatisk rotation och bildexport är de enda kartkommandona.
- Nodflytt, lasso och alternativa 2D-layouts tas bort.

## Aktivitet

- MCP-fokus tänder den verkliga noden.
- Byte mellan noder använder högst tolv verkliga kanter.
- En ljus partikel färdas längs den verkliga vägen.
- Aktivt fokus får en lokal synaptisk puls; tidigare besök lämnar avklingande värme.
- När en väg saknas visas två separata pulser utan en påhittad kant.

## Filter

Panelen behåller bara datadrivna filter:

- relation;
- bevisnivå;
- kopplingsstyrka;
- fristående noder;
- global sökning;
- agent och aktivitetstid.

Färg, form, sortering, avstånd, rutnät, minikarta, pilutseende och alternativa
placeringar tas bort.

## Teknik

Three.js renderar instansierade sfärer, verkliga kanter och aktivitetspartiklar
mot den befintliga Graphify-datan. Nuvarande server-, jämförelse-, audit-,
branch- och MCP-kontrakt ändras inte.

## Verifiering

- deterministisk kontroll av hjärnpositioner och A/B-separation;
- befintlig självkoll och responsiva tester;
- Playwright på mobil, surfplatta och desktop;
- canvas-pixelkontroll efter rotation;
- verklig MCP-sekvens med synlig fokusförflyttning.
