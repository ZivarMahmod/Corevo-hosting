# HANDOFF v2 — Corevo-mallar · 12 st (9 florist + 3 salong)

> Läs EN gång uppifrån och ned. Målet är oförändrat: implementera mallarna **exakt som de ser ut**.
> Nytt i v2: tre frisörmallar, och full efterlevnad av briefen "så här ska varje mall levereras"
> (manifest-block, mobil i filen, knappsemantik, focus-ring, inget exportskräp).

---

## 0. Vad du får

12 fristående `.dc.html` — **varje fil är HELA sajten**: all markup, all copy (svensk, i mallens röst),
alla bild-URL:er, all styling inline, all logik i `class Component extends DCLogic`, och sist i filen
`<script type="application/json" id="corevo-manifest">`. Filen är facit. Ingenting behöver härledas.

| # | key | Fil | Bransch | Identitet (1 mening) |
|---|-----|-----|---------|----------------------|
| 1 | `aurora` | Aurora - Romantisk Studio | florist | Blush + terracotta, valvbågar, kursiv serif |
| 2 | `calytrix` | Calytrix - E-handel | florist | Plommon/vin, kantigt, 3-stegskassa |
| 3 | `eloria` | Eloria - Klassiskt Magasin | florist | Mörkgrön + guld, hårlinjer, romerska siffror |
| 4 | `onyx` | Onyx - Mörk Studio | florist | Svart + mässing, fast vänsterrail, mono-etiketter |
| 5 | `blomstertorget` | Blomstertorget - Tidning | florist | Newsprint, masthead, blanketter A/B/C |
| 6 | `ateljevinter` | Ateljé Vinter - Galleri Minimal | florist | Gemener, tunna hårlinjer, numrerade verk |
| 7 | `sivsav` | Siv & Säv - Skandinaviskt | florist | Varmvitt/salvia, luftigt, pill-knappar |
| 8 | `lunaria` | Lunaria - Art Déco | florist | Bläckblått + champagneguld, geometri, Poiret One |
| 9 | `solsalt` | Sol & Salt - Medelhav | florist | Kobolt + solgult + terrakotta, soligt, DM Serif |
| 10 | `siluett` | Siluett - Modemagasin | **salong** | Porslin + bläck + elviolett, Bodoni, editorial, N°-numrering |
| 11 | `kalla` | Källa - Hårspa | **salong** | Sand + djup teal, Marcellus, ritual 01/02/03, lugnt tempo |
| 12 | `snitt` | Snitt - Svart Studio | **salong** | Svart onepager-känsla, poster-versaler, lime, signaturnamn på tjänster |

Plus: `tulpanbukett.png` (används av Calytrix Leveranskoll). `support.js` ingår INTE längre —
referensen är borttagen ur alla filer enligt briefen. Filerna förhandsvisas i Corevo-projektet
(där ligger identiska original med runtime); leveransfilerna här översätts mekaniskt.

---

## 1. Brief-efterlevnad — vad som är gjort i varje fil

- **§1 Format:** `<x-dc>`, `<helmet>`, `sc-if`/`sc-for`, `{{ }}`, `onClick`, `style`/`style-hover`,
  `DCLogic` — orört. `support.js`-taggen borttagen. Inga Cloudflare-obfuskerade e-postadresser (klartext).
- **§2 Manifest:** `#corevo-manifest` sist i varje fil, alla fält: `key` (ASCII-slug), `name`, `desc`,
  `bransch` (`florist`/`salong`), `palette` (exakt 8 nycklar), `fonts`, `radius`, `navHeight`, `caps`,
  `pages` (varje sc-if-sida → modul-nyckel eller `null` + route), `mock`, `verbatim`.
- **§3 Responsivt/a11y:** varje `<helmet><style>` slutar med blocket `/* Corevo-tillägg */`:
  - `@media (max-width:760px)`: alla `grid-template-columns` kollapsar till 1 kolumn (`!important`
    vinner över inline-styles), H1/H2 clampas, sektionspadding 20px, tap-targets ≥44px, nav-länkar
    får större träffyta. → 0 horisontell overflow @ 375 px.
  - `:focus-visible`-ring (2px i mallens primärfärg) på länkar, knappar, inputs, textareor.
  - **Alla handlingar är `<button>`**: lägg i korg, +/−, ta bort, välj tid/dag/frisör/betalsätt/
    leverans/belopp, betala, bekräfta bokning, gå med, skicka förfrågan. Navigation (nav, flikar,
    "Boka →"-genvägar som byter sida, footer) är `<a>` — de blir riktiga routes hos er.
- **§4 Innehåll:** färdig svensk copy i mallens röst, Unsplash-URL:er som platshållare,
  mockdata listad i manifestets `mock`.

**En ärlig fotnot om `primaryD`:** där mallen saknar en mörkare primär-nyans i själva filen är
`primaryD` en föreslagen hover-nyans, markerad * i §3 nedan. Övriga hex är kopierade ur filerna.
`solsalt.primaryD = #C2512E` är avsiktlig — mallens faktiska hover är terrakotta, inte mörkblå.

---

## 2. Absoluta regler (oförändrade från v1)

1. **Blanda aldrig mallarnas paletter, typsnitt eller former.** 12 slutna uttryck.
2. **Radie är per mall och binär** — se `radius` i respektive manifest. Ingenting däremellan.
3. **Kopiera hex exakt.** Paletterna står nu maskinläsbart i manifestet — använd dem därifrån.
4. **Bildbanken är verifierad.** Byt inte Unsplash-ID:n mot slumpbilder.
5. **Copy är svensk och mall-specifik.** Siluett säger "kasse", Källa "ritual", Snitt har
   signaturnamn på tjänster ("Som vanligt, fast bättre", "Solen gjorde det") — de ÄR designen,
   listade i manifestets `verbatim`.

---

## 3. Snabbref: palett + typ (fullständigt i varje fils manifest)

**Florister 1–9:** som v1, med två uppdateringar:
- **Sol & Salt (ny palett):** bg `#FAF3E1` · yta `#FFFCF2` · kobolt `#1F4F9C` · solgul `#F2C349` ·
  terrakotta `#C2512E` · bläck `#1E2B49` · linje `#EADDBB`. DM Serif Display + Figtree.
- **Lunaria:** bg `#10233A` · yta `#17304C` · guld `#C6A664` (*primaryD `#B08F4C`) · text `#ECE6D6` ·
  dämpad `#B8BFCB`/`#7C8AA0` · linje `#334455`. Poiret One + Jost.
- *primaryD-mintade: onyx `#B08434`, blomstertorget `#9E1F24`, sivsav `#647253`, lunaria `#B08F4C`.

**10 · Siluett** — bg `#F6F4EF` · yta `#FFFFFF` · bläck `#131313` · brödtext `#6E685D` · dämpad
`#9B9486` · linje `#E5E0D4` · violett `#6741D9` (*primaryD `#4E2BBE`) · violett-ton `#ECE5FB`.
Bodoni Moda (display + kursiva accenter) + Schibsted Grotesk. Radie 0. 2px bläcklinjer, versala
små etiketter, N°-numrering, kassa i steg 01/02/03, klubben heter "Första raden".

**11 · Källa** — bg `#F3EFE7` · yta `#FBFAF5` · bläck `#22302B` · brödtext `#5F6B60` · dämpad
`#93998C` · linje `#DAD3C2` · teal `#1D5E54` / mörk `#143F39` · mist `#E4EAE3`. Marcellus + Karla.
Radie 8px. Centrerade sektioner, ringcirklar 01/02/03, "Apoteket", "Ritualklubben" (3 prenumerations-
nivåer: Droppe/Källa/Flod), butiksflikar "Rummet"/"Anteckningar".

**12 · Snitt** — bg `#141412` · yta `#1D1D1A` · text `#EFEDE6` · dämpad `#A39F93`/`#6E6B61` ·
linje `#2C2C27` · lime `#D6F344` (*primaryD `#C4E52F`; svart text PÅ lime, aldrig tvärtom).
Anton (versal poster-display) + Work Sans. Radie 0. Lime toppstrip, sektionsetiketter "— Tjänster",
tjänster med signaturnamn + pris i lista, 5,0★-block, plats/öppettider-grid med kart-platshållare,
klubben heter "Insidan" (lime stamkort).

---

## 4. Salong-mallarnas sidschema (samma mönster i alla tre)

`pages` i manifestet är facit; mönstret är:

- `hem` → null `/` · `priser`/`behandlingar` → null (prislistan är alltid på) · `team` → null
- `boka` → **booking** (tjänst + frisör/terapeut + dag + tid; teamkorten och prisraderna
  förifyller bokningen via `bookAs()` — behåll den kopplingen)
- `butik`/`korg`/`kassa`/`bekraftelse` → **shop** (identisk varukorgsmodell som floristerna:
  `cart = { [id]: { id, name, priceNum, img, qty } }`)
- `journal` → **blogg** · `klubb` → **lojalitet** · `presentkort` → **presentkort** ·
  `event` → **offert** · `galleri`/`om`/`kontakt` → null
- Betalsätt överallt: Kort · Swish · Klarna · PayPal · Apple Pay, med villkorad hinttext (`payHints`).

Florist-avvikelser som redan är mappade i respektive manifest: `aurora.brollop` → offert,
`calytrix.club` → lojalitet, `calytrix.leverans` → shop (leveranskoll), `eloria.katalog` → shop,
`eloria.brollop` → offert, `eloria.konsultation` → booking.

---

## 5. Leveranschecklista (status per brief)

- [x] En fristående `.dc.html` per mall — ingen delad kod
- [x] `<helmet>` med `<title>`, font-`<link>`, `<style>` inkl. media queries
- [x] Alla sidor som `sc-if`-block
- [x] `class Component extends DCLogic` med `state` + `renderVals()`
- [x] `#corevo-manifest` med alla fält, i alla 12
- [x] Varje sida i `pages` har modul-nyckel eller uttryckligen `null`
- [x] Alla 8 palett-nycklar ifyllda (mintade `primaryD` markerade i §3)
- [x] 0 overflow @ 375 px (grid-kollaps + H1/H2-clamp) · tap-targets ≥44 px i mobil ·
      synlig focus-ring · `<button>` för handlingar
- [x] Inget `support.js`, ingen e-post-obfuskering
- [x] `key` är ASCII-slug utan å/ä/ö

## 6. Vad du INTE ska göra (oförändrat)

- Inte slå ihop till "ett tema med varianter". 12 egna uttryck.
- Inte ersätta verbatim-copy med generisk branschtext.
- Inte lägga till/ta bort moduler. Inte byta bilder. Inte "nästan samma" hex.
