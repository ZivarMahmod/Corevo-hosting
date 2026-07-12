# Önskelista → Claude Design (12 mallar)

Skickas till Claude Design INNAN mallarna byggs. Syfte: en `.dc.html` per mall som kan
transpileras till vårt tema-paket **mekaniskt, utan att någon gissar**. Referensfilen som
bevisade formatet fungerar: `Ateljé Vinter — Galleri Minimal`.

Grundregel: **filen är LAG.** Ingen komponent byts, inget "förbättras", inget härleds om.
Allt jag behöver för att inte gissa måste stå i filen.

---

## A. Formatet — behåll exakt som Ateljé Vinter

Behåll allt: `<x-dc>`, `sc-if`, `sc-for`, `{{ }}`, `onClick="{{ fn }}"`, `style-hover="…"`,
inline-styles, `class Component extends DCLogic` med `state` + `renderVals()`.
Allt det är mekaniskt översättbart. **Ändra inte formatet, "städa" det inte.**

Ta däremot bort exportskräpet: `<script src="./support.js">` och Cloudflares
`email-decode.min.js` / `__cf_email__`-obfuskering (skriv e-postadressen i klartext).

---

## B. Manifestet — det enda NYA jag ber om (viktigast)

Lägg ett JSON-block sist i filen. Det dödar 100 % av gissningarna:

```html
<script type="application/json" id="corevo-manifest">
{
  "key": "ateljevinter",
  "name": "Ateljé Vinter",
  "desc": "Galleri-minimal. Blommor som objekt.",
  "bransch": "florist",

  "palette": {
    "primary": "#6F7D6E", "primaryD": "#5A6659", "bg": "#FBFBF9",
    "surface": "#F3F3EE", "fg": "#161616", "fg2": "#8B8B85",
    "line": "#E4E4DE", "accentSoft": "#B9B9B2"
  },
  "fonts": { "heading": "Manrope", "body": "Manrope" },
  "radius": "0px",
  "navHeight": { "desktop": "68px", "mobile": "56px" },

  "caps": { "heroEyebrow": true, "homeStats": false, "homeGallery": true, "homeAbout": true },

  "pages": {
    "hem":         { "module": null,           "route": "/" },
    "butik":       { "module": "shop",         "route": "/shop" },
    "korg":        { "module": "shop",         "route": "/varukorg" },
    "kassa":       { "module": "shop",         "route": "/kassa" },
    "bekraftelse": { "module": "shop",         "route": "/kassa/tack" },
    "boka":        { "module": "booking",      "route": "/boka" },
    "kurser":      { "module": "kurser",       "route": "/kurser" },
    "blogg":       { "module": "blogg",        "route": "/blogg" },
    "vanner":      { "module": "lojalitet",    "route": "/lojalitet" },
    "offert":      { "module": "offert",       "route": "/offert" },
    "presentkort": { "module": "presentkort",  "route": "/presentkort" },
    "galleri":     { "module": null,           "route": "/galleri" },
    "om":          { "module": null,           "route": "/om" },
    "kontakt":     { "module": null,           "route": "/kontakt" }
  },

  "mock": ["rawProducts", "courses", "galleryItems", "blog", "bookSlots", "bookServices", "quoteTypes", "giftOptions", "delOpts", "payDefs"],
  "verbatim": ["navLabels", "rooms", "payDefs[].hint", "alla rubriker och brödtext"]
}
</script>
```

**Varför varje fält:**

| Fält | Varför jag inte kan gissa det |
|---|---|
| `key` | Måste in i fyra register (`registry.ts`, `layouts.ts`, `tenant-data.ts`, palett-listan). Slug, gemener, ASCII, inga å/ä/ö. |
| `palette` (8 nycklar) | Vårt `FloristPalette`-kontrakt har exakt dessa åtta. Plockar jag hex ur inline-styles gissar jag vilken som är `surface` vs `accentSoft`. |
| `caps` | Fyra booleans styr vad hem-sidan får rendera. Fel gissning = tom eller trasig sektion. |
| `pages[].module` | **Kritiskt.** Poetiska namn är bra design men "vänkretsen" ≠ maskinnyckel. Utan mappningen kopplar jag fel modul, och en kund som stänger av lojalitet får kvar en död länk. Tillåtna nycklar: `booking`, `shop`, `blogg`, `offert`, `lojalitet`, `presentkort`, `kurser`, `media_library`, eller `null` (= alltid på). |
| `mock` | Vilka arrayer som är påhittad demodata (ersätts av kundens DB) vs riktigt innehåll. Utan listan riskerar jag hårdkoda sex unsplash-blommor som "produkter". |
| `verbatim` | Copy som ÄR designen och aldrig får ersättas av generisk bransch-text. |

---

## C. Responsivt — det enda som annars FAIL:ar mekaniskt

Ateljé Vinter är byggd för desktop: `grid-template-columns:1fr 1fr` / `repeat(3,1fr)` utan
brytpunkter. Vid 375 px spricker den → vår probe FAIL:ar på horisontell overflow, och jag får
inte "fixa" den (då improviserar jag och bryter designen).

**Be Design ta ansvar för mobilen i filen.** Antingen:
- media queries i `<helmet>`-blockets `<style>` (klasser går bra där), eller
- intrinsiskt responsiva grids: `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`

Hårda krav som probe mäter:
1. **0 horisontell overflow vid 375 px.** Ingen `min-width`/fast px-bredd som spränger viewporten.
2. **Tap-targets ≥ 44 px** höjd på allt klickbart (flera `<a>` i filen är ~28 px höga).
3. **Synlig focus-ring** på länkar/inputs/knappar (`outline:none` utan ersättning finns idag i alla inputs → tangentbordsanvändare tappar bort sig).
4. Semantik: klickbara element som `<button>` när de inte navigerar (idag `<a onClick>` överallt).

---

## D. Innehåll & bilder

- **Foton:** fortsätt gärna med Unsplash-URL:er som platshållare — men lägg ID + beskrivning i manifestet så vi vet vad kunden ska ersätta med. Ingen bild får vara nödvändig för att layouten ska hålla ihop (tom bild → ingen kollaps).
- **Copy på svenska**, i mallens egen röst. Skriv den färdig — jag skriver aldrig egen text.
- **Priser/datum/antal** är mockdata. Markera dem i `mock`.

---

## E. Vad jag gör med filen (så ni vet vad som händer)

Per mall blir det ett tema-paket i `components/storefront/layouts/<bransch>/`:

```
<key>.theme.ts        ← manifestet ovan, 1:1
<Key>Layout.tsx       ← HEM
<key>.chrome.tsx      ← nav + footer
<key>.pages.tsx       ← om / tjänster / kontakt
<key>.modules.tsx     ← butiksvy + bloggvy
<key>.product.tsx / .cart.tsx / .checkout.tsx   ← om mallen har butik
<key>*.module.css     ← style-hover + media queries hamnar här
```

Varje sida i `sc-if` blir en riktig route (inte state-flik). Varukorgen kopplas till vår
riktiga köp-räls (`useCart` / `<AddToCart>`) — mallens `addToCart` blir bara UI:t.
**Formen (pixlar, färg, typografi, copy, komposition) rörs inte.**

---

## F. Kort version att klistra in till Claude Design

> Bygg 12 mallar i exakt samma `.dc.html`-format som "Ateljé Vinter — Galleri Minimal".
> Behåll x-dc/sc-if/sc-for/DCLogic precis som det är. Tre tillägg:
> 1. Ett `<script type="application/json" id="corevo-manifest">`-block sist i filen med
>    `key`, `name`, `desc`, `bransch`, `palette` (8 hex), `fonts`, `radius`, `navHeight`,
>    `caps` (4 booleans), `pages` (varje sida → modul-nyckel + route), `mock`, `verbatim`.
>    Modul-nycklar: booking, shop, blogg, offert, lojalitet, presentkort, kurser, media_library, null.
> 2. Responsivt på riktigt: 0 overflow vid 375 px, tap-targets ≥44 px, synlig focus-ring.
> 3. Inget `support.js`, ingen Cloudflare-email-obfuskering.
>
> Allt annat — komposition, färg, typografi, copy — är er sak och kopieras rakt av.
