# Riktiga floristsajter — KOMPONENT-mönster (runda 0, research)

Datum: 2026-07-12. Metod: HTTP-hämtning av HTML + länkade stylesheets, programmatisk extraktion av
`border-radius`, `aspect-ratio`, `transition`, `text-transform`, knapp-regler och DOM-signaler
(announcement / drawer / stepper / mega-meny / skeleton). Ingen kod, text, bild eller varumärke kopieras —
bara mätbara strukturmönster, i egna ord.

Notation: **[M]** = uppmätt ur sajtens CSS/HTML. **[I]** = inferens från klassnamn/plattform (Shopify/Squarespace-mönster)
eller från designpraxis — ska inte citeras som fakta, bara som riktning.

---

## 1. KNAPPEN (primär köp-CTA)

| Sajt | Radie [M] | Padding/höjd [M] | Versaler [M] | Transition [M] | Tolkning av tillstånd [I] |
|---|---|---|---|---|---|
| interflora.se | Design-token-system: `--DS-radius-standard: 5px` (38 träffar), `--DS-radius-rounded: 9999rem` (piller, 7), `--DS-radius-circle: 50%` (16) | Primär: `16px` block-padding + `24px` inline (token space-200/300); `--large`: 24/32px; `--with-icon` sänker till 8px block | ja (finns i CSS) | tokeniserad timing/easing (`--DS-transition-accelerate-fast-*`) | Piller-CTA + 5px-yta. Token-styrd hover; ikon-varianten är en egen storleksklass (ikonen kostar höjd, inte hack) |
| euroflorist.se | `--btn-radius` → `9999px` (piller, 19 träffar) | typografi-token `typo--buttons_default`: 18px, medium vikt, letter-spacing-medium | ja | `0.2s ease` / `0.3s ease`-familj | Piller är knapp-radien; kort/inputs har egen (`--radius-md/sm`). Fler brand-teman delar samma komponent, byter bara tokens |
| bloomandwild.com | Dominerande `0` (38) + `50%` (21) för ikoncirklar; små 2–6px för chips | — (utility-driven) | ja | `.2s` / `.3s`, plus långsam `color .8s` på vissa ytor | Kant-lös (0px) knapp-språk. Ikon-knappar = perfekt cirkel. Två hastighetsklasser: snabb för UI, långsam för färgskift |
| floom.com | `.375rem` (6px) dominerar; enstaka `.25/1/1.5rem` | Tailwind-lik | ja | `.15s`/`.2s` `cubic-bezier(.4,0,.2,1)` (10 träffar) | Enda liten radie (6px) genom hela UI. Snabb ease-out-kurva = standard |
| mcqueens.co.uk | `5px` (71!) som bas + 14/16/18/23px på specialytor + `50%` (14) | knappblock med `10px 30px` padding | ja | `all 0.5s ease-in-out` (100 träffar), `0.3s` (20) | Lyxsegment: långsam, mjuk transition. Men `all`-transition + 4 olika radier = spretigt — inte att kopiera |
| freddiesflowers.com | Rent token-system: `--ff-radius-l` (26), `-m` (13), `-0`, `-round`, plus `--btn-radius` / `--btn-radius-pill` | Knappstorlekar som klasser: `.btnSm/.btnMd/.btnLg` med `--btn-height-*`, `--btn-py-*`, `--btn-px-*` | ja | `--btn-transition ≈ .2s ease-in-out`, appliceras explicit på `background-color, color, border-color, box-shadow` — aldrig `all` | **Bäst i klassen.** Höjd är en token, inte padding-tur. Transition listar exakt vilka props som rör sig |
| sadiesfloral.com | Mest `0` (7) + `50%`/`100%` för ikoner; en enstaka `999px` | — | ja | `background-color 170ms ease-in-out` (8 träffar, även med border-color) | Skarpa hörn. Hover = ren färgövergång på 170ms, inget lyft |
| tonicblooms.com (Shopify) | `50%` för cirklar, annars `0`/16px | — | **nej** (ingen uppercase) | `all 0.2s cubic-bezier(.645,.045,.355,1)` + `transform 0.2s ease` | Gemena knappar, redaktionellt uttryck. Transform-transition = lyft/zoom finns |
| hautefloral.com | `2px` bas, `30px`/`1000px` på enstaka piller | — | ja | `background .1s ease-in` | Näst intill skarpa hörn (2px). Extremt snabb hover (100ms) |

Mönster: **antingen 0–6px (skarp/redaktionell) eller full piller (999px) — mellanlägen (12–20px) förekommer bara som misstag/spretighet.**
`transition: all` ses bara hos den sajt som också har flest radier — korrelationen "slarv följer slarv" är synlig.

Tillstånd som inte gick att mäta statiskt (hover/press/focus/disabled/loading) — så här ser marknadsstandarden ut [I]:
hover = mörkare fyllning + ev. 1–2px lyft; press = tillbaka till 0 lyft (inget nytt utseende); focus = synlig ring/outline
(krävs för tangentbord); disabled = sänkt opacitet + `cursor: not-allowed`; loading = knappen **behåller sin bredd**
och byter etikett mot spinner (annars hoppar layouten).

---

## 2. PRODUKTKORTET

| Sajt | Bild-ratio [M] | Pris/namn [I] | Hover [M/I] | Höjd-utjämning [I] |
|---|---|---|---|---|
| interflora | `1/1` | pris under namn | fade/opacity-övergångar i CSS | grid-rader, kort sträcks |
| euroflorist | `1/1` (12), `4/3` (5), `6/7`, `3/5` — flera medvetna format | pris under namn, ord.pris genomstruket bredvid | `transform .2s ease` = zoom/lyft finns | fixed ratio + flex-kolumn |
| bloomandwild | **`5/4`** (11) — liggande, dominerar | pris under namn | `.2s`/`.3s` + långsam färg | 5/4 låser radhöjden |
| floom | `2/3`, `4/3`, `16/9` | — | `transform`-transition | — |
| freddies | `1/1` (4) + `5/4`, `4/3` | — | `opacity 0.2s` (bild-2-korsfade) | — |
| mcqueens | ingen aspect-ratio i CSS → höjd sätts av bilden | — | `all .5s` bildzoom | risk för ojämna kort |
| tonic | `1 / 1` | — | `transform .2s` | — |

Slutsatser: **exakt en aspect-ratio per mall** (1/1 eller 5/4 eller 4/5 — inte tre).
Hover-repertoaren i branschen är liten: (a) bildzoom ~1.03–1.05, (b) korsfade till bild 2, (c) knapp/quick-add glider upp.
Ingen seriös florist gör alla tre samtidigt.

---

## 3. NAVIGATIONEN (vi har 9 länkar)

| Sajt | Lösning | Korg/konto | Announcement-bar [M] |
|---|---|---|---|
| interflora | få topp-länkar + sticky-nav; stepper & skeleton i DOM | korg höger | `sticky` finns; utility-innehåll (Klarna/Swish-märken) |
| euroflorist | `dropdown` i DOM, kategori-drivet | korg höger | — |
| bloomandwild | egen navbar-komponent med transform-transition (nav krymper vid scroll) | korg höger | — |
| mcqueens | **`mega`-meny** + `sticky` | korg höger | — |
| freddies | `dropdown` + `drawer` (mobil) + `sticky` | korg som **drawer** | — |
| sadies | `announcement` + `dropdown` | korg höger | ja |
| haute | `announcement` + `dropdown` | korg höger | ja |
| tonic | `dropdown` | korg höger | — |

Mönster: **ingen** av dem lägger 9 platta länkar i rad. De gör 4–6 topp-länkar där 1–2 öppnar dropdown/mega,
och skickar resten (Om oss, Kontakt, Leverans, Blogg) till footern eller en tunn utility-rad.
Announcement-bar löses genom att den **scrollar bort** och bara navet är `sticky` (annars äter två sticky-lager 100px höjd).

---

## 4. FOOTERN

Genomgående (alla 9): nyhetsbrevs-fångst (`newsletter` i DOM hos i princip alla), 3–5 kolumner,
**textlänkar — aldrig knappar** (enda knappen är nyhetsbrevets skicka-knapp).
Innehåll som återkommer: leverans/leveranszoner, öppettider/kontakt, betalmärken (Klarna/Swish syns hos SE-sajterna),
sociala ikoner, juridik-rad längst ner. Ikoner i footern är cirklar (`50%`), vilket är den enda legitima "andra radien".

---

## 5. MIKRO-INTERAKTIONER (uppmätta signaler)

- `skeleton` i DOM: interflora, freddies → laddningsplatshållare istället för hopp.
- `drawer`: freddies → varukorgen glider in, ingen sidladdning.
- `quantity` / `stepper`: interflora, freddies, sadies, tonic, haute → antalsväljare är standard.
- `transform`-transitions (`.2s`): euroflorist, floom, tonic → bildzoom/lyft.
- `opacity 0.2s`: freddies → korsfade bild 1 → bild 2.
- Långsamma `.5s`-svep: mcqueens (lyx-tempo, men på `all` = kostsamt).

---

## 6. RADIE-DISCIPLIN

| Sajt | Antal distinkta radier | Dom |
|---|---|---|
| freddies | 4 tokens (0 / m / l / round) | ✅ token-styrd, alla radier har namn |
| interflora | 3 tokens (5px / piller / cirkel) | ✅ disciplinerat |
| floom | 1 huvudradie (6px) | ✅ |
| euroflorist | knapp=piller, kort=md, input=egen | ✅ per-roll |
| sadies / haute | 0–2px + cirkel | ✅ skarpt |
| bloomandwild | 0 + cirkel | ✅ |
| mcqueens | 5, 14, 16, 18, 23px + 50% | ❌ spretigt |

**Regeln marknaden följer: radie är en ROLL, inte en smaksak.** Yta (kort/panel) = en radie. Kontroll (knapp/input) = en radie.
Ikon-cirkel = 50%. Tre värden totalt, inte sju. Vår misstanke om "piller + ikoncirkel + rundade kort utan mening" är precis
den spretighet som bara den svagaste sajten i urvalet uppvisar.

---

# DESTILLAT — de 10 reglerna vi bygger efter

1. **Radie-kontrakt: max 3 värden per mall, som tokens.** `--r-surface` (kort/panel), `--r-control` (knapp/input), `--r-round: 50%` (bara ikoncirklar). Varje mall väljer EN profil: *skarp* (surface 0–4px, control 0–4px) eller *piller* (surface 4–8px, control 999px). Ingen mall blandar piller-knapp med 16px-kort utan att det är profilen.
2. **Köp-CTA: 48px hög (sm 40 / lg 56), horisontell padding 24px (lg 32px), font-weight 600, letter-spacing 0.02em.** Höjd sätts av `--btn-height`, ALDRIG av padding+line-height-tur. Versal/gemen bestäms per mall — men konsekvent i hela mallen.
3. **Transition: 160–200ms `ease-out` (`cubic-bezier(.2,0,.2,1)`), och ALDRIG `transition: all`.** Lista props: `background-color, border-color, color, transform, box-shadow`. Lyx-mallar får gå upp till 300ms — men bara på transform/opacity.
4. **Knappens 6 tillstånd är obligatoriska, inga undantag:** hover = 8% mörkare fyllning + `translateY(-1px)`; active/press = `translateY(0)` + 12% mörkare; focus-visible = 2px ring med 2px offset (aldrig `outline:none` utan ersättning); disabled = opacity .5 + `cursor:not-allowed` + inga hover-effekter; loading = spinner ersätter etiketten med **låst bredd** (`min-width` från vilo-läget) så inget hoppar.
5. **Produktkort: exakt EN aspect-ratio per mall** (`1/1`, `4/5` eller `5/4`), `object-fit: cover`, bilden i en `overflow:hidden`-wrapper.
6. **Kortets hover gör högst TVÅ saker:** bildzoom `scale(1.04)` @ 300ms ease-out (+ ev. korsfade till bild 2 @ 200ms), och kort-lyft `translateY(-2px)` + skugga. Aldrig zoom + lyft + glidande knapp + badge-animation samtidigt.
7. **Kortet är ett flex-kolumn-kort med `h-full` + `mt-auto` på pris/CTA-raden**, så olika långa namn ger samma korthöjd; namn klipps på 2 rader (`line-clamp-2`, `min-height: 2 rader`). Ordning låst: bild → (badge överlagrad, top-left, 12px in) → namn → ev. metadata → pris → CTA.
8. **Nav: max 6 topp-länkar.** Har mallen 9 destinationer → 5 topp + 1 dropdown/mega som samlar resten; övrigt (Om oss, Kontakt, Leverans, Blogg) lever i footern. Ordning höger: sök → konto → korg (med räknar-badge). Nav-höjd är en token (`--nav-h`, 64–72px desktop).
9. **Announcement-bar scrollar bort — bara navet är sticky.** Sticky-lagret får aldrig bli två. Sidans innehåll offsettas med `--nav-h`, inte med magiska px.
10. **Fem mikro-interaktioner är minimikravet för att kännas äkta:** (a) varukorgs-drawer som glider in från höger 240ms + "Tillagd i varukorgen"-bekräftelse, (b) antals-stepper (−/värde/+) med disabled på min, (c) skeleton-block (aldrig spinner-blank, aldrig layout-hopp) vid laddning, (d) fade-in-up 400ms vid scroll-in, en gång, respekterar `prefers-reduced-motion`, (e) bildzoom på kort-hover. Allt annat är grädde.
