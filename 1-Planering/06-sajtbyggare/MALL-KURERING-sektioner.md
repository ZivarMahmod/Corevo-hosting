# Sajtbyggare — look-bibliotek + bransch-modell (2026-06-17, rev 2)

> **Korrigering (Zivar 2026-06-17):** Mallar är INTE bundna till branscher. En mall = en **LOOK**
> (CSS/layout/sektioner), bransch-agnostisk. **ALLA branscher kan välja ALLA looks.** En klinik kan
> köra florist-mallens look med sina egna bilder/färger för att de tyckte den var fin.
> Modulerna är en SEPARAT, optimerad funktion-grej som mountas in i looken.
> *(rev 1 hade fel ram — band mall→bransch. Skrotat.)*

## §0 — Två lager som ALDRIG blandas

| Lager | Vad det är | Bundet till bransch? | Hur det byggs |
|---|---|---|---|
| **LOOK** (mall/template) | layout · sektioner · typografi · demo-bilder · färg-default | **NEJ — fritt val** | många bransch-fria skins (det här bygget) |
| **FUNKTION** (modul) | booking · shop · offert · meny · portfolio · lojalitet ... | Ja — via config + variant | **en gång, optimerat**; mountas i mallens slot |

Tenant väljer **1 look** (vilken som helst) **+ sina moduler** (bransch-config) **+ sitt innehåll**
(bild/text/färg via editerbara regioner). De tre lagren är ortogonala — de möts först vid render.

**Exempel (Zivars):** Klinik gillar florist-looken → väljer florist-mallen → byter florist-blommorna
mot klinik-bilder → justerar färg → får klinik-modulerna (booking + intag) invävda i mallens slot. Funkar.

## §0.5 — Vad du ser IDAG vs målet (theme ≠ template — får ALDRIG blandas)
**Idag** erbjuder onboardingen bara **5–6 React-teman** (Salvia · Leander · Zigge · Linnea · Edit · Bohem =
färg/font-paletter ovanpå EN layout). Det är INTE look-väljaren — det är bara paletter. Därför "ser du bara 5".

**Målet:** onboarding-steget **"Välj look"** visar ett **galleri av de riktiga mallarna** — varje mall = sin
egen distinkta look med thumbnail. När du onboardar en sida väljer du EN mall → den blir sidans look.
- De 5–6 temana **degraderas** till start-paletter inuti en look (eller pensioneras). De är inte look-valet.
- En mall får ALDRIG smälta ihop med ett tema. **En mall = en hel egen look, valbar för sig.**

**Kedjan dit:** `goal-36` bygger looks → varje registreras som valbar (id + thumbnail + manifest) →
`goal-38` byter ut 6-tema-väljaren mot **mall-galleriet** i onboardingen. (Det är därför picker:n inte syns än —
den byggs i goal-38, och looks att välja bland byggs i goal-36.)

### Formatet — "samma format som de 6" = picker-KONTRAKT, inte token-flattening
Onboarding-skärmen säger det själv: *"Nya vendor-mallar importeras som data via sajtbyggaren — engångs-jobb per mall."*
Varje mall blir en **valbar entry i SAMMA Temamall-lista** som de 6: `{ id · namn · vibe-taggar · thumbnail · render-typ }`.
- ✅ **Wrappa** mallen så den VISAS som de 6 (entry + live-preview).
- ❌ **Platta ALDRIG** ner en mall till 5 färg/font-tokens → då tappas layouten = hela looken = hela poängen.
  Mallen behåller sin fulla HTML/layout/sektioner; den får bara samma *omslag* som ett tema.
- **Mekanism — look-registry (en lista, två render-typer):**
  - 6 teman → `render: 'theme'` (ST_THEMES-tokens på bas-layout, som idag).
  - N mallar → `render: 'template'` (full HTML via render-bron + manifest).
  - Picker läser registryt och listar BÅDA likadant; previewen dispatchar på `render`-typ.
- **Per-mall-jobbet är redan bevisat** (piloten, restoran) → "engångs-jobb per mall" = bounded, repeterbart.

## §1 — Curering = KVALITET, inte bransch
Filtret är inte längre "matchar en bransch". Det är:
- ✅ **Storefront-struktur** — hero + innehållssektioner + minst en plats för moduler.
- ✅ **Licensbar** — kräver-kredit OK (behåll footer-attribution); skippa kräver-köp + okänd.
- ✅ **Snygg + distinkt** — bidrar med variation, inte en dublett av en bättre mall.
- ❌ **Admin-paneler** — sneat, materio, dashmin, darkpan, star-admin2, celestialAdmin, Breeze (8 st).
  Interna dashboards, INGEN storefront-struktur → kan aldrig vara en kund-sida. Hård skip.
- ❌ Junk / dubbletter / import-scripts.

**Resultat:** av 110 → skippa 8 admin + 2 köp + 1 okänd + junk/dubbletter ≈ **~90 möjliga looks.**
Men bygg INTE alla 90 blint. Ta de **bästa, mest varierade ~30–50** (kvalitet + stil-bredd > antal).
Build-once, additivt — fler looks adderas när som helst utan att röra de byggda.

## §2 — Looks grupperade efter STRUKTUR (avgör modul-sloten, ej bransch)
Strukturen styr VAR/HUR moduler vävs in — därför grupperas bygget så. Stil-variation väljs INOM varje grupp.

| Struktur | Modul-slot mallen vill ha | Bra kandidater (ur katalogen) |
|---|---|---|
| **Service-storefront** (hero→tjänster→boka) | booking | frisör (haircut, alotan, BarberX, barberz, haircare, hairsal), vård (klinik, orthoc, dentcare), carserv |
| **Mat/meny** | meny + booking(bord) | restoran (KLAR), Restaurantly, keto, foody2, feane, cakezone, baker |
| **Shop/retail** | shop | multishop, woody, GrowMark, fruitkha, vegefoods |
| **Portfolio/visuellt** | portfolio + booking | studio, photozone, fotogency |
| **Generell/landing** (flexibel) | valfri slot | stride, sterial, revolve, a-world, Capiclean, motto, boldo |

Alla dessa är **bransch-fria looks** — en tenant i vilken bransch som helst kan välja vilken som helst.
Tabellen säger bara vilken modul-slot mallen naturligt bär, inte vem som "får" använda den.

## §3 — Seamen (ärlig brasklapp)
Sektions-SEMANTIK bär kvar mallens ursprungs-flavor:
- **Generiska sektioner** (hero, tjänster, om, galleri, kontakt) → reskinnar till vad som helst, rent.
- **Hyper-specifika sektioner** (florists "bröllopspaket", restaurangs "meny-kategorier") → best-fit för sin
  typ, men **editorn (goal-37) döljer/byter sektioner** → en klinik gömmer "bröllop" och skriver sitt.
- **Booking-typен** (tid/staff vs bord/party_size) = **config + goal-40**, ALDRIG mallen. Mallen har bara en
  generisk `<corevo-module type="booking">`-slot; configen avgör hur den renderar.

## §4 — Bygg: batcher av looks, parallellt (workflow-orkestrering)
- **Bransch-fritt.** Varje mall byggs som en skin: verbatim layout + editerbara regioner (text/bild/färg) +
  generisk modul-slot i main + behåll demo-innehåll som platshållare (tenant byter sen).
- **Batch = ~5–6 STILMÄSSIGT VARIERADE mallar** (inte 6 av samma typ) → fan-out 1 subagent/mall (disjunkta
  filer), oberoende verify-agent, **0 FAIL** via per-template proof-spec (goal-36 M2).
- **FROZEN/read-only — forka aldrig parallellt:** `manifest/types.ts`, `render-bridge`, `booking-mount`, flaggan.
- **STOPP mellan batcher** för Zivars verify. `/compact` i tid.

### Batch 1 — prova pipelinen ÖVER stilar (bättre än 6 likadana)
restoran (≈klar, mat) + 1 barber-mörk (BarberX) + 1 minimal (sterial) + 1 varm (alotan/haircare) +
1 portfolio (studio) + 1 shop (multishop). → bevisar mönstret över alla 5 strukturtyper på en gång.

## §5 — Skip helt
8 admin-paneler · kräver-köp (brber, 51 hotelier) · okänd licens (razor) · junk/dubbletter/scripts.
Allt annat = potentiell look (bygg de bästa först, addera resten additivt).
