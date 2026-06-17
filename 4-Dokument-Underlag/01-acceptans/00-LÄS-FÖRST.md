# 00 — LÄS FÖRST

Hej Code/Cowork. Det här är leveransen för **Corevo Booking** — en white-label
bokning-SaaS för flera branscher. **En databas, en kodbas, isolering per `tenant_id`.**

> **Allt du behöver ligger i den här mappen (`LEVERANS/`).** Mappen `OLD/` i roten är
> bara gammal referens — bygg inte från den.

---

## Vad som är NYTT (byggt 2026-06-16)

| Fil | Vad det är |
|---|---|
| **`01-BASELINE.md`** | ⭐ Kartan. Vad som är sanning, vad du ska bygga, i vilken ordning. **Börja här efter denna.** |
| **`02-Arkitektur-sanning.html`** | Läsbar avstämning: riktiga databasen vs designen. Öppna i webbläsaren. 10 sektioner. |
| **`02-Arkitektur-sanning.md`** | Samma som ovan i text + SQL-förslag. |
| **`super-admin/`** | Onboarding-studion (DITT verktyg). Klickbar prototyp av hela onboarding-resan. Entry: `index.html`. |
| **`kund-admin/`** | Kundens egen admin (M6). Modul-driven — navet byggs av de moduler som valdes i onboarding. Entry: `index.html`. |
| **`standalone/`** | Färdigbyggda, självständiga versioner (funkar offline, dubbelklicka). `Onboarding-studio.html` + `Kundadmin.html` + `Modulkatalog.html`. |
| **`standalone/Modulkatalog.html`** | ⭐ NYTT. Storefront med **alla 15 moduler** renderade live samtidigt. Byt bransch → ser branschens anpassningar, men varje modul finns med (inga låsningar). Referens för hur varje modul ser ut på publika sidan + per-bransch-spec i vänsterspalten. |

> **Snabbtest utan kod:** öppna `standalone/Onboarding-studio.html`, `standalone/Kundadmin.html`
> och `standalone/Modulkatalog.html` i en webbläsare. Inget bygge behövs.

---

## Hela resan, i tre ytor

```
   superbooking@corevo.se                 KUNDEN                    BESÖKAREN
   ──────────────────────                 ──────                    ─────────
   super-admin/  (studion)   ──lansera──▶ kund-admin/  ◀──styr──    publika sajten
   väljer bransch + moduler               ser BARA sina             ser de moduler
   + branding → deploy                    aktiva moduler            som är 'live'
```

**Den röda tråden du bad om:** modulerna du aktiverar i onboarding registreras i
`tenant_modules` → de tänds som funktioner i kundens admin **och** som sektioner på
den publika sidan. Aktivera Webshop → "Produkter" + "Ordrar" dyker upp i adminen och
en shop-sektion på sajten. Stäng av → de släcks. Inget byggs om — det är samma kodbas,
bara rad-data som skiljer (se `02-Arkitektur-sanning.html` §10).

---

## Mappar i roten (utanför LEVERANS)

| Mapp/fil | Roll |
|---|---|
| `OLD/` | Gammalt — tidigare deliverables, ui_kits, handoff. **Referens, inte sanning.** |
| `firsör-sas/1-Planering/` | Dina egna planeringsdokument (modulkarta, flöden, DB-schema). |
| `styles.css` · `colors_and_type.css` | Designtokens (forest/gold back-office + storefront-teman). Giltiga. |
| `uploads/` | Dina egna inklistrade skisser/skärmbilder. |
| `README.md` · `SKILL.md` | Projekt-/designsystem-meta. |

---

## Tre saker att inte missa (detaljer i 01-BASELINE.md §4)

1. **Riktiga databasen är sanningen för vad som kan deployas IDAG** — 7 moduler (`live:true`), 5 verticals. Allt annat i studion är **roadmap** (`live:false`, märkt «Roadmap»): Zivars avsikt, ej seedad än. **Bygg det live'a mot DB — radera INTE roadmap-delen.** Att lägga till en bransch = en `verticals`-rad; en ny modul = tabell + RLS (sanningsdoc §0b + §7).
2. **En riktig bugg finns** i din seed: `verticals.default_modules` säger `"loyalty"` men modulen heter `"lojalitet"`. Rätta innan default-moduler kopieras.
3. **Mockup ≠ funktion** — knapparna i prototyperna är till stor del visuella. Varje yta är märkt med vilken DB-tabell den läser/skriver i verkligheten.

Lycka till. Frågor som ändrar arkitekturen ställs innan kod skrivs.
