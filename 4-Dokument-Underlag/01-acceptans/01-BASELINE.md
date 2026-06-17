# BASELINE — Corevo Booking (handoff till Code)

> **Datum:** 2026-06-16 · **Status:** ren baseline, redo att implementeras.
> **En mening:** white-label bokning-SaaS för flera branscher — en databas, en
> kodbas, isolering per `tenant_id`. Superadmin onboardar kunder via en studio med
> live-preview; varje kund får en egen sajt + admin på `<slug>.corevo.se`.

Detta dokument är **kartan**. Det pekar ut vilka filer som gäller, vad som är
sanning, och vad Code ska bygga. Läs det här först — sedan `02-Arkitektur-sanning.html`.

> **Allt ligger i `LEVERANS/`.** Sökvägar nedan är relativa till den mappen. `OLD/` i roten = gammal referens.

---

## 1. Vad som är SANNING (auktoritativt, i prioordning)

| # | Fil | Roll |
|---|---|---|
| 1 | **Den riktiga Supabase-databasen** (`clylvowtowbtotrahuad`) | Yttersta sanningen. Schema, RLS, funktioner. Allt annat böjer sig hit. |
| 2 | **`02-Arkitektur-sanning.html`** | Läsbar avstämning DB vs design. 10 sektioner. Läs i webbläsaren. |
| 3 | **`02-Arkitektur-sanning.md`** | Samma innehåll som råtext + SQL-förslag, för repot. |
| 4 | **`super-admin/`** (källan) | Onboarding-studion: hela onboarding-flödet som klickbar mockup. |
| 5 | **`kund-admin/`** (källan) | Kundens egen admin (M6) — modul-driven klickbar mockup. |
| 6 | **`../firsör-sas/1-Planering/`** | Dina egna planeringsdokument (modulkarta, flöden, DB-schema). |

> **Regel:** krockar design och DB → **DB vinner.** Mockupen ritar avsikt, inte sanning.

---

## 2. Mappstruktur (allt under `LEVERANS/`)

```
LEVERANS/
  00-LÄS-FÖRST.md            ← toppguide (börja där)
  01-BASELINE.md             ← denna fil — kartan
  02-Arkitektur-sanning.html ← läsbar DB-vs-design (viktigast)
  02-Arkitektur-sanning.md   ← samma + SQL-förslag
  super-admin/               ← ONBOARDING-STUDION (ditt verktyg)
    index.html               ← entry
    cfg-data.js              ← DATA: 7 moduler, 5 branscher, 6 teman, domän, lansering
    app.jsx · studio.jsx · preview.jsx · stages.jsx
    primitives.jsx · icons.jsx · HANDOFF.md
  kund-admin/                ← KUNDENS ADMIN (M6) — modul-driven
    index.html               ← entry
    data.js                  ← presets + modul→ytor-karta + mock-data
    app.jsx                  ← skal: onboarding-simulator + dynamiskt nav + router
    surfaces-core.jsx        ← Översikt, Bokningar, Tjänster, Personal, Schema
    surfaces-more.jsx        ← modul-ytor + Kunddatabas, Varumärke, Inställningar
    primitives.jsx · icons.jsx
  standalone/
    Onboarding-studio.html   ← självständig, funkar offline
    Kundadmin.html           ← självständig, funkar offline
```

> Standalone-filerna är **kompilerade kopior** — redigera aldrig dem. Ändra i källan
> (`super-admin/` resp. `kund-admin/`), bygg om standalone vid behov.

**Den här omgångens innehållsändringar (sammanfattat):**
- Onboarding av **KUND** (inte "salong") — branschneutralt.
- Konto-moduler (husdjur/fordon/intag/orderstatus) routas till **Mitt konto**, inte publika sidan.
- **Kundens admin (M6) byggd** — modul-driven: navet byggs av aktiva moduler. Aktiverar du Webshop i onboarding → Produkter + Ordrar tänds i adminen.
- Riktiga **admin-vyer** per modul (storefront-yta vs admin-yta).
- **Inga obligatoriska moduler** — allt valbart.
- **6:e temat** tillagt: *Atelier Bohem* (mjuk boho/florist).
- Subdomän `boka.corevo.se` → **`corevo.se`** (gratis Universal SSL, inget wildcard-köp).
- Jämfört mot **riktiga DB:n**: 7 moduler & 5 branscher är sanning, resten var mockup.

---

## 3. Vad som är GAMMALT (i `OLD/` — referens, inte sanning)

Flyttat till `OLD/` i roten. Speglar INTE nödvändigtvis den nya 7-modul/5-bransch-sanningen.
Behandla som visuell referens:

```
OLD/Corevo Back-office.html · OLD/Corevo-salongsdemo.html · OLD/Corevo M6 - Build Spec (Code).html
OLD/backoffice-pages/ · OLD/ui_kits/ · OLD/design_handoff_backoffice/ · OLD/handoff-assets/
OLD/preview/ · OLD/PROMPT-TILL-CODE.md
```
- `OLD/ui_kits/` = visuellt orakel (så det ska *se ut*). Bra, men säger "salong" på sina ställen.
- Kvar i roten: `colors_and_type.css` / `styles.css` (designtokens, giltiga), `firsör-sas/` (planering), `uploads/` (dina skisser).

**Städat bort tidigare:** `screenshots/` (236 arbets-bilder), gamla `onboarding/`, `slides/`, en canvas-statefil.

---

## 4. Det du VERKLIGEN behöver tänka på (innan Code börjar)

1. **Loyalty-nyckel-buggen är på riktigt.** `verticals.default_modules` säger `"loyalty"`,
   modulen heter `"lojalitet"`. Default-aktivering av lojalitet är trasig tills detta rättas.
   SQL-förslag finns i sanningsdokumentet §6. **Kör i staging först.**

2. **Fyra mallar är tomma.** `edit`, `leander`, `linnea`, `zigge` är vertical-defaults men
   har 0 sektioner. En nagelstudio (default `linnea`) får tom sajt. Måste seedas.

3. **Mockup ≠ funktion.** Studions knappar är till stor del visuella. Det som har "riktig"
   data-koppling står utskrivet i sanningsdokumentet (DB-tabell per modul). Allt annat
   är avsikt som Code ska implementera — inte färdig logik.

4. **Betal-rails är pausade** (beslut 14.2). shop/presentkort/deposit visar UI men rör
   inga pengar. `payments_enabled=false`. Bygg flödet, koppla inte Stripe än.

5. **Bild/text i preview funkar inte i mockupen — men DB:n stödjer det.** Text→`content_slots`,
   bild→`media_assets`+`content_slots`. Code behöver bara R2-upload + UPSERT. Sanningsdok §5.

6. **De extra branscherna/modulerna du listat** (bilverkstad, tatuering, portfolio, meny…)
   finns INTE i DB. Återanvänd-bara branscher = bara nya `verticals`-rader. Nya *moduler*
   = nya tabeller + RLS + `modules`-rad = större jobb. Gör per riktig kund, inte spekulativt.

7. **Domän:** `<slug>.corevo.se` (gratis). Subdomänen skrivs in i wrangler vid onboarding
   så nästa deploy inte tappar den. Egen kunddomän = Cloudflare for SaaS, senare.

8. **Per-tenant-ändringar är rad-isolering, inte kodkopiering.** Ändra `tenant_modules.config`
   för kund X → bara X påverkas. Ändra global modulkomponent → ALLA påverkas. Sanningsdok §10.

---

## 5. Ordningen Code bör jobba i

1. Rätta loyalty-nyckeln (§6) + seeda tomma mallar (§2 ovan).
2. Bygg de 7 modulerna med sina två ytor (storefront + admin) enligt sanningsdok §1.
3. Koppla onboarding-lanseringen till DB-sekvensen (sanningsdok §8).
4. Bygg slot-redigeringen (text + bild) mot `content_slots`/`media_assets`.
5. Wrangler/Cloudflare: subdomän-provisionering + magic-link-mail (de enda script-bitarna).
6. `tenant-overrides/<slug>/` som escape hatch för helt bespoke kundsidor.

---

*Frågor som ändrar arkitekturen ställs innan kod skrivs, inte efter. Lycka till.*
