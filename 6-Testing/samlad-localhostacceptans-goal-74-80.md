# Samlad localhostacceptans — Goal 74–80

Datum: 2026-07-23

## Utfall

- Hela webbtestsviten: `350` testfiler, `2736` tester, `0` fel.
- Goal 80:s korrigerade kundarbetsyta: `6/6` riktade kontraktstester.
- Typkontroll: godkänd.
- Lint: `0` fel; endast tidigare kända varningar.
- Produktionslik preview-build: godkänd mot Supabase-branchen
  `localhost-acceptance`.
- Browseracceptans: kundarbetsyta, Sida-preview desktop/mobil, website-only,
  extern bokning och FreshCuts fasta kundwebb är körda lokalt.
- Oberoende Fable 5-granskning: `NO P0/P1`.
- Produktionsmiljön har inte ändrats.

## Lokalt låst

- Goal 75–80 fungerar tillsammans i samma lokala arbetsyta.
- Mallbyte bevarar kundens publicerade innehåll och erbjuder uttryckligt val
  mellan nuvarande redigering och mallens eget innehåll.
- Website-only-kunder kan ha admin och webbplats utan intern bokningsmodul.
- FreshCut använder den fasta kundwebben och externa bokningslänkar.
- Superadminens valda kund får en fullbreddsarbetsyta; Sida-preview kan växla
  mellan verklig desktop- och mobilbredd.

## Kan inte slutbevisas på localhost

- Goal 74:s verkliga SMS/PIN-kedja genom Giada/SIM, operatörsavbrott,
  fallbackleverans och canary-inkorg.
- Produktionsmigrationer och slutlig databas-/RLS-verifiering.
- Produktionsdomäner, Cloudflare, DNS, TLS/HTTPS och riktiga hostcookies.
- Riktig e-post/SMS-leverans, betalproviderwebhooks och andra externa
  produktionsintegrationer.
- Själva deployen och rollbacken.

De punkterna körs först i den gemensamma releasegenomgången. Lokal acceptans
ger inte tillåtelse att deploya eller migrera produktion.
