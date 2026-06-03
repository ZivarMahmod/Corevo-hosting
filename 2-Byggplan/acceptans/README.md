# Acceptans-paket — så blir designen *exakt*, inte ungefär

> **Varför detta finns:** "eyeball-verifierat" ger drift. Tre köringar / 18 timmar
> gick på att Code byggde mot *utseende* och re-härledde värden. Det här paketet
> byter ut ögonmått mot **mätbara påståenden** Code kör mot den *live* sidan.
> En sida är inte "klar" förrän probe-skriptet ger **0 FAIL**.

## Mentalmodellen (läs en gång)

| Lager | Roll | Fil |
|---|---|---|
| HTML/JSX-mock | Visuellt **orakel** — "så här ska det *se ut*" | `../components/*.jsx`, `mock-*.png` här |
| Tokens som kod | **Sanningen i repot** — exakta värden | `5-Kod/.../tokens.css` (= `../tokens.json`) |
| Playbook | **Kontraktet** — elegansreglerna | `2-Byggplan/DESIGN-ELEGANS-playbook.md` |
| **Acceptans (detta)** | **Domaren** — pass/fail per sida | `_shell-och-tokens.md` + `<sida>/CHECKLISTA.md` + `<sida>/*.accept.spec.ts` |

HTML klistras **aldrig** in. Den läses som bild. Sanningen Code bygger mot är
tokens + playbook. Domaren avgör om bygget matchar — **mekaniskt**.

## Den stängda loopen (detta dödar driften)

För **en sida i taget**:

1. **Bygg** mot `<sida>/CHECKLISTA.md` + playbooken. Inga gissade värden.
2. **Kör live** — `pnpm --filter @corevo/web dev` (eller deployad route).
3. **Skärmdumpa** den live sidan. Lägg bredvid `mock-*.png`. Titta side-by-side.
4. **Mät** — kör `<sida>/*.accept.spec.ts` (Playwright) ELLER klistra
   `probe.js`-funktionen i devtools/`page.evaluate`. Den returnerar **varje FAIL
   med uppmätt vs förväntat värde**.
5. **Fixa varje FAIL.** Re-kör. Upprepa tills **0 FAIL**.
6. Först då: "klar". Skriv resultatet (0 FAIL + skärmdump-diff) i `HANDOFF.md`.

> "Ser klart ut" är inte ett steg. Om probe:n inte är grön är sidan inte klar.

## Vad varje sid-mapp innehåller

```
acceptans/
  README.md               ← detta
  _shell-och-tokens.md     ← gäller VARJE sida (shell, världar, tokens) — kör först
  probe.js                 ← den generella mät-motorn (selector→förväntat → pass/fail)
  varumarke/
    mock-varumarke.png          ← orakel (kontroller)
    mock-varumarke-preview.png  ← orakel (flaggskepps-preview)
    CHECKLISTA.md               ← mätbara påståenden, exakta värden, live-route
    varumarke.accept.spec.ts    ← körbar Playwright-acceptans
```

## Prioritetsordning (playbookens §5)

1. **Varumärke** (flaggskeppet — *byggt här*) →
2. Dashboard → 3. Bokningar (+drawer) → 4. Kunder → 5. Tjänster →
6. Schema → 7. Personal → 8. Inställningar → 9. Frisör idag → 10. Kund-portal.

Säg till så bygger jag acceptans-mappen för nästa sida i samma format.

## Den gyllene regeln

> En assertion som inte är **mätbar i en enhet** (px, hex, computed font-family,
> ms) hör inte hemma här. "Känns elegant" är playbookens jobb; den här mappen
> handlar bara om sådant en maskin kan döma. Det är därför den stoppar drift.
