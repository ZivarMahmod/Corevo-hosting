# Zivar Graph Studio — oberoende agentaktivitet

Datum: 2026-07-27
Status: Godkänd i samtalet med Zivar

## Mål

Agentaktivitet ska synas ovanpå den grafvy som Zivar själv har valt. En agent
får aldrig ändra vald hjärna, jämförelseläge, sökning, filter, layout, zoom eller
kamera. Zivar ska kunna navigera fritt utan att störa agentens arbete eller
loggning.

## Beteende

- Användarens grafvy och agentaktiviteten är två separata tillstånd.
- Live visar en tydlig agentmarkör, etikett och puls på verkliga grafnoder utan
  att filtrera, byta vy eller flytta kameran.
- Om den aktiva noden inte ingår i den renderade vyn visas aktiviteten i en
  diskret agentindikator med hjärna och nodnamn. Ingen vy ändras automatiskt.
- Användaren kan byta vy, filter, zoom och kamera medan live eller replay pågår.
- Agenthändelser av typen `view`, `search`, `refresh` eller liknande får loggas
  men får inte köras som kommandon mot användarens gränssnitt.
- Endast mål som kan kopplas till en verklig nod via `target`, `label`, `file`
  eller `files` markeras i grafen. Olösta händelser stannar i loggen och skapar
  aldrig en falsk nod.

## Live, replay och logg

- `Följ live` visar nya agenthändelser när de kommer.
- `Spela senaste passet` spelar hela det senaste sammanhängande aktivitetspasset
  från början. Ett nytt pass börjar efter minst 30 minuters inaktivitet.
- Replay använder alla agenter som ingår i passet och påverkar inte användarens
  grafinställningar.
- Loggen är kompletterande historik för att kunna gå tillbaka och följa en äldre
  väg. Agent- och värmefilter ligger under `Avancerat`.

## Acceptans

1. Ett inkommande fokus- eller view-event lämnar samtliga användarval oförändrade.
2. En löst nod får synlig aktivitetspuls i aktuell graf utan omrendering av
   basgrafens urval.
3. Aktivitet i annan hjärna eller utanför aktuellt filter syns som indikator men
   byter inte vy.
4. Replay börjar vid senaste passets första händelse och når dess sista händelse.
5. Vy-, filter- och kamerabyte under live/replay avbryter varken loggning eller
   uppspelning.
6. Reducerad rörelse behåller etikett och status utan tvingad animation.

## Avgränsning

Ingen ny sessionsdatabas eller exakt `run_id` införs. Tidsluckan på 30 minuter
är tillräcklig tills riktiga körnings-id:n faktiskt behövs.
