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

Den samlade branchen är `codex/launch-inventory-customer-design`. Goal 74 är
arkiverat som lokalt klart. Goal 75–76 väntar på den gemensamma releasen; Goal
77–80 är verifierade lokalt enligt respektive klar-fil.

## Nästa byggordning

9. **Goal 82 — personaladmin och tenantlivscykel**
   Lås roll-/platsbehörighet, pausad tenant, personalens riktiga vardagsflöden
   och branschneutral copy utan ny redesign.
10. **Goal 83 — tenantens regionala grundkontrakt**
    Gör locale, land, valuta, tidszon och telefonformat serverägda. Svensk
    lansering förblir enda releasescope; inget andra land byggs.
11. **Goal 84 — komplett onboarding till första bokning**
    Bevisa create → configure → publish → nåbar storefront → första verifierade
    bokning mot Supabase-preview.
12. **Goal 85 — fail-closed lokal releaseövning**
    Lås migrations-, säkerhets-, host-, scheduler-, rollback- och
    deploykontrakt utan att deploya produktion.
13. **Goal 86 — en gemensam localhostacceptans**
    En kort användarmatris för Goal 74–85. Zivar testar en gång; godkända delar
    fryses och inga nya funktioner läggs till före samlad release.

Full exekveringsplan finns i
`1-Planering/19-lanseringsprogram/08-goal81-86-exekveringsplan.md`.

## Samlad release efter Goal 86

Produktionsmigrationer, portalhost/HTTPS, deploy, domänsmoke, e-postcanary och
de autentiserade manuella rollproven görs tillsammans med Zivar. Dessa är
releasebevis, inte skäl att hålla lokalt färdig produktkod öppen.

## Regler

- En aktiv byggdel åt gången: beslut → test → kod → verifiering → lokal låsning.
- Inget Goal 83–86 öppnas som aktiv goal-fil innan föregående del är låst.
- `corevo.se`-roten är POS-/plattformsyta; tenantstorefront använder
  `*.boka.corevo.se`.
- Ingen parallell motor, kö, roll-, person- eller statusmodell byggs.
- Funktioner som kan verifieras lokalt ska bli 100 % lokalt innan Goal 86.
