# Brief till Claude Design — så här ska varje mall levereras

Detta är hela kravspecen. Ge den till Claude Design i sin helhet. Den som bygger mallarna
behöver inte veta något om vår kodbas utöver det som står här.

Referensfilen som bevisade att formatet fungerar: **`Ateljé Vinter — Galleri Minimal.dc.html`**.
Bygg alla mallar exakt så — plus de tre tilläggen i §2, §3, §4.

---

## 0. Grundregeln

**Filen är facit.** Den som implementerar mallen i produktionskoden får inte byta en enda
komponent, inte "förbättra", inte hitta på. Allt som behövs för att slippa gissa måste alltså
finnas **i filen**. Det är hela poängen med den här briefen.

En leverans = **en fristående `.dc.html`-fil per mall**. Ingen delad kod mellan mallar.
Varje mall är en egen sajt med egen form — inte ett tema ovanpå en gemensam mall.

---

## 1. Formatet — behåll precis som Ateljé Vinter

Behåll allt detta oförändrat:

- `<x-dc>`-wrappern
- `<helmet>` med `<title>`, Google-fonts-länk och `<style>`-block
- `sc-if value="{{ … }}"` för sidor/vyer
- `sc-for list="{{ … }}" as="x"` för listor
- `{{ uttryck }}` för värden
- `onClick="{{ fn }}"`
- `style="…"` inline och `style-hover="…"`
- `<script type="text/x-dc">` med `class Component extends DCLogic { state = {…}; renderVals() {…} }`

**Ändra inte formatet. Städa det inte. Modernisera det inte.** Det översätts mekaniskt hos oss.

### Ta bort (exportskräp)
- `<script src="./support.js">`
- Cloudflares `email-decode.min.js` och `__cf_email__`-obfuskeringen — skriv e-postadressen i klartext.

---

## 2. TILLÄGG 1 — manifest-blocket (viktigast av allt)

Sist i filen, före `</body>`. Utan detta block måste vi härleda värden ur inline-styles,
och att härleda **är** att gissa.

```html
<script type="application/json" id="corevo-manifest">
{
  "key": "ateljevinter",
  "name": "Ateljé Vinter",
  "desc": "Galleri-minimal. Blommor som objekt.",
  "bransch": "florist",

  "palette": {
    "primary":     "#6F7D6E",
    "primaryD":    "#5A6659",
    "bg":          "#FBFBF9",
    "surface":     "#F3F3EE",
    "fg":          "#161616",
    "fg2":         "#8B8B85",
    "line":        "#E4E4DE",
    "accentSoft":  "#B9B9B2"
  },

  "fonts":     { "heading": "Manrope", "body": "Manrope" },
  "radius":    "0px",
  "navHeight": { "desktop": "68px", "mobile": "56px" },

  "caps": {
    "heroEyebrow": true,
    "homeStats":   false,
    "homeGallery": true,
    "homeAbout":   true
  },

  "pages": {
    "hem":         { "module": null,          "route": "/" },
    "butik":       { "module": "shop",        "route": "/shop" },
    "korg":        { "module": "shop",        "route": "/varukorg" },
    "kassa":       { "module": "shop",        "route": "/kassa" },
    "bekraftelse": { "module": "shop",        "route": "/kassa/tack" },
    "boka":        { "module": "booking",     "route": "/boka" },
    "kurser":      { "module": "kurser",      "route": "/kurser" },
    "blogg":       { "module": "blogg",       "route": "/blogg" },
    "vanner":      { "module": "lojalitet",   "route": "/lojalitet" },
    "offert":      { "module": "offert",      "route": "/offert" },
    "presentkort": { "module": "presentkort", "route": "/presentkort" },
    "galleri":     { "module": null,          "route": "/galleri" },
    "om":          { "module": null,          "route": "/om" },
    "kontakt":     { "module": null,          "route": "/kontakt" }
  },

  "mock": [
    "rawProducts", "courses", "galleryItems", "blog",
    "bookSlots", "bookServices", "quoteTypes", "giftOptions",
    "delOpts", "payDefs"
  ],

  "verbatim": [
    "navLabels", "rooms", "payDefs[].hint",
    "alla rubriker och all brödtext"
  ]
}
</script>
```

### Fältförklaring — vad varje fält gör hos oss

| Fält | Krav | Varför |
|---|---|---|
| `key` | slug, **gemener, ASCII, inga å/ä/ö**, unik | Skrivs in i fyra register i koden. `ateljevinter`, inte `Ateljé Vinter`. |
| `name` | mallens visningsnamn | Visas i mallväljaren. |
| `desc` | en mening | Visas i mallväljaren under namnet. |
| `bransch` | `florist`, `ekonomi`, `salong`, … | Avgör vilken svit mallen hamnar i. |
| `palette` | **exakt dessa 8 nycklar**, hex | Vårt palettkontrakt har åtta platser. Plockar vi hex ur inline-styles vet vi inte vilken som är `surface` och vilken som är `accentSoft`. Ni vet. |
| `fonts` | `heading` + `body`, Google-fontnamn | Måste matcha `<link>`-taggen i `<helmet>`. |
| `radius` | t.ex. `"0px"`, `"4px"`, `"999px"` | Mallens hörnradie som en siffra, inte utspridd i 40 inline-styles. |
| `navHeight` | desktop + mobil | Sticky nav → vi behöver höjden för scroll-offset. |
| `caps` | 4 booleans | Styr vilka hem-sektioner som får renderas. Fel gissning = tom eller trasig sektion. |
| `pages` | varje `sc-if`-sida → modul + route | **Kritiskast.** Se nedan. |
| `mock` | namn på variabler med demodata | Så vi inte hårdkodar sex påhittade blommor som kundens riktiga sortiment. |
| `verbatim` | copy som ÄR designen | Den texten får aldrig ersättas av generisk branschtext. |

### `pages` — den viktigaste raden i hela briefen

Poetiska sidnamn är bra design. "Vänkretsen", "Gåvobrev", "Rum I" — behåll dem i UI:t.
Men vår motor känner bara maskinnycklar, och varje kund slår **på och av moduler individuellt**.
Om vi inte vet att "vänkretsen" = `lojalitet`, så får en kund som stängt av lojalitet en död
länk kvar i navigationen.

**Tillåtna modul-nycklar (inga andra finns):**

```
booking        bokning / tidsbokning
shop           webshop, varukorg, kassa, produktsidor
blogg          artiklar / anteckningar
offert         offertförfrågan / beställningsverk
lojalitet      kundklubb / medlemskap
presentkort    presentkort / gåvobrev
kurser         kurser / seminarier / workshops
media_library  mediabibliotek
null           sidan är ALLTID på (hem, om, kontakt, galleri)
```

Sätt `"module": null` bara för sidor som varje kund alltid har. Allt annat måste peka på en nyckel.

---

## 3. TILLÄGG 2 — responsivt på riktigt

Ateljé Vinter är ren desktop: `grid-template-columns:1fr 1fr` och `repeat(3, 1fr)` utan
en enda brytpunkt. Vid 375 px spricker den.

Det här är inte en detalj vi kan laga i efterhand — gör vi det, **improviserar vi**, och då
är designen inte längre er. **Mobilen måste ligga i filen.**

Lös det antingen med media queries i `<helmet>`-blockets `<style>` (klasser är helt OK där),
eller intrinsiskt: `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`.

**Fyra krav som mäts mekaniskt — allt annat är FAIL, inte "nästan":**

1. **0 horisontell overflow vid 375 px.** Inga fasta px-bredder eller `min-width` som spränger viewporten.
2. **Tap-targets ≥ 44 px höjd** på allt klickbart. (I referensfilen är flera länkar ~28 px.)
3. **Synlig focus-ring** på länkar, inputs och knappar. (Referensfilen har `outline:none` på varje input utan ersättning — tangentbordsanvändare tappar bort sig helt.)
4. **Semantik:** element som utför något (lägg i korg, välj tid, betala) ska vara `<button>`, inte `<a onClick>`. Bara verklig navigation är `<a>`.

---

## 4. TILLÄGG 3 — innehåll, bilder, copy

- **Copy:** färdig, på svenska, i mallens egen röst. Vi skriver aldrig egen text — saknas den, blir det tomt.
- **Foton:** Unsplash-URL:er som platshållare är helt OK. Layouten måste hålla ihop även om bilden saknas (tom bild → ingen kollaps).
- **Priser, datum, antal, lediga tider:** mockdata. Lista variablerna i manifestets `mock`.
- **Ingen bransch-specifik text hårdkodad i motorn** — allt som är text bor i mallen.

---

## 5. Vad som händer med filen sen (FYI)

Varje `.dc.html` blir ett tema-paket i vår kodbas:

```
<key>.theme.ts        ← manifest-blocket, 1:1
<Key>Layout.tsx       ← hem-sidan
<key>.chrome.tsx      ← nav + footer
<key>.pages.tsx       ← om / tjänster / kontakt
<key>.modules.tsx     ← butiksvy + bloggvy
<key>.product.tsx     ← produktsida   (om mallen har butik)
<key>.cart.tsx        ← varukorg       (om mallen har butik)
<key>.checkout.tsx    ← kassa          (om mallen har butik)
<key>*.module.css     ← style-hover + media queries hamnar här
```

Varje `sc-if`-sida blir en riktig route (inte en state-flik). `addToCart` i er `DCLogic` byts
mot vår riktiga varukorg — **er knapp, vår motor.**

**Formen — pixlar, färger, typografi, copy, komposition — rörs inte. Den kopieras rakt av.**

---

## 6. Leveranschecklista per mall

- [ ] En fristående `.dc.html`
- [ ] `<helmet>` med `<title>`, font-`<link>` och `<style>` (inkl. media queries)
- [ ] Alla sidor som `sc-if`-block
- [ ] `class Component extends DCLogic` med `state` + `renderVals()`
- [ ] `<script type="application/json" id="corevo-manifest">` — alla fält ifyllda
- [ ] Varje sida i `pages` har en modul-nyckel (eller uttryckligen `null`)
- [ ] Alla 8 palett-nycklar ifyllda
- [ ] 0 overflow @ 375 px · tap-targets ≥ 44 px · synlig focus-ring · `<button>` för handlingar
- [ ] Inget `support.js`, ingen Cloudflare-email-obfuskering
- [ ] `key` är ASCII-slug utan å/ä/ö
