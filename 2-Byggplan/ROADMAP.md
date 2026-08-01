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
10. **Goal 83 — tenantens regionala grundkontrakt**
11. **Goal 84 — komplett onboarding till första bokning**

Den samlade branchen är `codex/launch-inventory-customer-design`. Goal 74 är
arkiverat som lokalt klart. Goal 75–76 väntar på den gemensamma releasen; Goal
77–84 är verifierade lokalt enligt respektive klar-fil.

## Nästa byggordning

12. **Goal 87 — modulstate, readiness och DB-säkerhet**
    Lås dagens modulstates, defaults, publika grindar, readiness, RLS och
    katalogkontrakt.
13. **Goal 88 — en kundarbetsyta och en sidmotor**
    Samla superadmin och kundadmin på SidaStudioV2/revisioner och gör varje
    verklig modul nåbar från rätt yta.
14. **Goal 89 — storefront, preview och mallslots — KODKLAR**
    Preview och publik yta använder samma modulägda loaders, navigation,
    CTA-gating och fasta mallslots. Full lokal teknisk verifiering är grön.
    Samlad användaracceptans återstår i Goal 86.
15. **Goal 90 — blogg, kurser och galleri — KODKLAR**
    Lås innehållslivscykel, eventintegritet och galleri/media från kundadmin
    genom preview till storefront. Full teknisk verifiering, previewacceptans
    och oberoende omgranskning är gröna. Samlad användaracceptans återstår i
    Goal 86.
16. **Goal 91 — presentkort och lojalitet — KODKLAR I PREVIEW**
    Manuella presentkorts- och lojalitetsvärden är tenantbundna, append-only,
    idempotenta och samtidighetsverifierade. Betald issuance, leverans och
    refund förblir fail-closed till Goal 92; samlad browseracceptans sker i
    Goal 86.
17. **Goal 92 — media, offert och webshop — INTERNT TEKNISKT GRÖN**
    SQL, concurrency, interna providergränser, browser och full kodkvalitet är
    gröna. Fyra verkliga externa sandbox-/runtimeprov är tydligt blockerade och
    Goal 92 ligger därför kvar öppet.
18. **Goal 93 — katalog och mekanisk mallacceptans — TEKNISKT GRÖN**
    12 teman, 174 rutter, 376/376 matrisfall och 12/12 verkliga previewteman är
    gröna. Samlad användaracceptans återstår i Goal 86.
19. **Goal 85 — fail-closed lokal releaseövning — NÄSTA**
    Lås migrations-, säkerhets-, host-, scheduler-, rollback- och
    deploykontrakt utan att deploya produktion, före den samlade releasen.
20. **Goal 86 — en gemensam localhostacceptans**
    Testa hela den byggda lokala produkten, inklusive Goal 74–93. Zivar testar
    en gång; godkända delar fryses och inga nya funktioner läggs till före
    samlad release.

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
