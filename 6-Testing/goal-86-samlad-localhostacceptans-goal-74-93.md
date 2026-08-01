# Goal 86 — samlad localhostacceptans Goal 74–93

Status: **VÄNTAR PÅ ZIVARS INLOGGADE TESTSESSION**

Kör ett steg i taget på en uttryckligt kontrollerad lokal host och session.
Markera inte ett steg grönt förrän både handlingen och det synliga resultatet
är kontrollerade. Produktion ska vara orörd.

## Gemensam UI-kontroll för varje yta

- [ ] Primär handling finns som synlig knapp eller tydlig länk.
- [ ] Knappen gör rätt sak och visar lyckat, laddar, tomt och fel-läge begripligt.
- [ ] Ingen viktig handling göms av meny, sticky yta, overflow eller tangentbord.
- [ ] Desktop och 390 px mobil fungerar utan horisontell sidscroll.
- [ ] Direkt URL och fel roll nekas server-side, inte bara genom dold knapp.

## Produktkedjan

- [ ] Goal 74: fel PIN, rätt PIN och tre fel/ny kod ger rätt synlig återkoppling.
- [ ] Goal 75: kundportal, säkerhet/enheter och PWA-flöde fungerar.
- [ ] Goal 76: tenant kan inte publiceras före grön readiness.
- [ ] Goal 77: mallbyte visar säkert innehållsval och bevarar kunddata.
- [ ] Goal 78: website-only och extern bokningslänk fungerar utan intern bokning.
- [ ] Goal 79: FreshCuts fasta webb och dess CTA fungerar på desktop och mobil.
- [ ] Goal 80: kundarbetsytan visar Spara utkast och Publicera även på mobil.
- [ ] Goal 81: fyra bokningslägen samt representativ djuplänk och platsbyte fungerar.
- [ ] Goal 82: ägare, manager och personal ser endast sina verkliga handlingar.
- [ ] Goal 83: svenska datum, tider, SEK och telefonformat är konsekventa.
- [ ] Goal 84: ny tenant går från onboarding till första bokning och avbokning.
- [ ] Goal 87: off/draft/live/paused syns begripligt och blockerar rätt handlingar.
- [ ] Goal 88: kundadmin och superadmin använder samma editor och revisionshistorik.
- [ ] Goal 89: preview och publik sida visar samma navigation, CTA och modulstatus.
- [ ] Goal 90: blogg, kurser och galleri kan hanteras och visas utan dolda actions.
- [ ] Goal 91: presentkort och lojalitet fungerar; poängformuläret ryms på mobil.
- [ ] Goal 92: media, offert och webshop visar blockerad provider tydligt och säkert.
- [ ] Goal 93: alla 12 teman har fungerande navigation, CTA, moduler och mobilvy.

## Slutgrind

- [ ] Goal 85-rapporten är grön.
- [x] Läsande renhetskontroll 2026-08-02 visar inga syntetiska E2E-rader i
  preview; ingen städskrivning behövs.
- [ ] Alla fel har ett avgränsat regressionstest.
- [ ] Godkända delar fryses; därefter planeras release separat.
