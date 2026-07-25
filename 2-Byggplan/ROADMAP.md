# ROADMAP — Corevo

Detta är projektets enda aktuella byggordning. Produktion lämnas orörd tills
alla lokala byggdelar och Zivars gemensamma localhostacceptans är klara.

## Låst lokalt på samma branch

1. **Goal 74 — PIN och kanalval**
2. **Goal 75 — kundportal, säkerhet och PWA**
3. **Goal 76 — provisionering och readiness**
4. **Goal 77 — säkert mallbyte och innehållsägande**
5. **Goal 78 — webbplatsläge och extern bokning**
6. **Goal 79 — FreshCuts fasta kundwebb**
7. **Goal 80 — superadminens kundarbetsyta**
8. **Goal 81 — bokningsmotorns fulla variantmatris**
9. **Goal 82 — personaladmin och tenantlivscykel**

Den samlade branchen är `codex/launch-inventory-customer-design`. Goal 74 är
arkiverat som lokalt klart. Goal 75–76 väntar på den gemensamma releasen; Goal
77–82 är verifierade lokalt enligt respektive klar-fil.

## Nästa byggordning

10. **Goal 83 — tenantens regionala grundkontrakt**
    Gör locale, land, valuta, tidszon och telefonformat serverägda. Svensk
    lansering förblir enda releasescope; inget andra land byggs.
11. **Goal 84 — komplett onboarding till första bokning**
    Bevisa create → configure → publish → nåbar storefront → första verifierade
    bokning mot Supabase-preview.
12. **Goal 87 — modulstate, readiness och DB-säkerhet**
    Lås dagens modulstates, defaults, publika grindar, readiness, RLS och
    katalogkontrakt.
13. **Goal 88 — en kundarbetsyta och en sidmotor**
    Samla superadmin och kundadmin på SidaStudioV2/revisioner och gör varje
    verklig modul nåbar från rätt yta.
14. **Goal 89 — storefront, preview och mallslots**
    Låt preview och publikt använda samma modulägda loaders i mallägda fasta
    slots, med säkert mallbyte.
15. **Goal 90 — innehållsmoduler**
    Lås blogg, kurser och galleri end-to-end.
16. **Goal 91 — presentkort och lojalitet**
    Lås atomisk inlösen, audit och capability-grindar.
17. **Goal 92 — media, offert och webshop**
    Verkställ mediakvot och lås dagens offert- och commerceflöden.
18. **Goal 93 — katalog och mekanisk mallacceptans**
    Synka modul-/vertikalkatalogen och mekaniskt verifiera de tolv
    Corevo-mallarna.
19. **Goal 85 — fail-closed lokal releaseövning**
    Lås migrations-, säkerhets-, host-, scheduler-, rollback- och
    deploykontrakt utan att deploya produktion.
20. **Goal 86 — en gemensam localhostacceptans**
    En kort användarmatris för Goal 74–85. Zivar testar en gång; godkända delar
    fryses och inga nya funktioner läggs till före samlad release.

Full exekveringsplan finns i
`1-Planering/22-modulprogram/01-lokal-fardigstallandeplan.md`.

## Samlad release efter Goal 86

Produktionsmigrationer, portalhost/HTTPS, deploy, domänsmoke, e-postcanary och
de autentiserade manuella rollproven görs tillsammans med Zivar. Dessa är
releasebevis, inte skäl att hålla lokalt färdig produktkod öppen.

## Regler

- En aktiv byggdel åt gången: beslut → test → kod → verifiering → lokal låsning.
- Endast pågående byggdel har en aktiv goal-fil; senare mål beskrivs i
  färdigställandeplanen tills föregående del är låst.
- `corevo.se`-roten är POS-/plattformsyta; tenantstorefront använder
  `*.boka.corevo.se`.
- Ingen parallell motor, kö, roll-, person- eller statusmodell byggs.
- Funktioner som kan verifieras lokalt ska bli 100 % lokalt innan Goal 86.
