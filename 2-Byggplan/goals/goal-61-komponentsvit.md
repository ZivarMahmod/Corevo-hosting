# goal-61 — Komponentsviten (uiverse-anatomin in i hela Corevo)

Efterföljare till goal-60 (som dödade viruset: 255 inline-stilar → 14). goal-60 gjorde det
MÖJLIGT för ytor att ha tillstånd. goal-61 ger dem faktiskt innehåll: riktiga knappar, riktiga
kvitton, riktiga tillstånd — hämtade ur Zivars uiverse-dump.

**Källunderlag:** `4-Dokument-Underlag/uiverse-komponentbibliotek.md` (126k tecken, klistrat
2026-07-12, återvunnet ur transkriptet efter compact).

## Regeln som styr allt

**Vi kopierar ANATOMI, aldrig kod.** uiverse-komponenterna bär exakt de vices vi just utrotade:
hårdkodade hex, `transition: all`, id-selektorer, magiska px, hover-only-affordances, noll
`prefers-reduced-motion`. En rå inklistring återinför viruset i en ny skepnad.

### Porterings-checklistan (varje komponent, utan undantag)
1. Hex → `--sf-*`-token med **mörkt** fallback-ink (vitt på plattform-guld = 2.41:1; mörkt = 6.4:1).
2. `transition: all` → namngivna properties. Aldrig `all`.
3. Sex lägen: rest · hover · active · focus-visible · disabled (**aldrig via opacity**) · loading.
4. `prefers-reduced-motion` nollar **`transform` OCH `animation`**, inte bara `transition`
   (en `transition: none` gör transformen *ögonblicklig*, inte borta).
5. 44px touch-golv. Hover-reveal måste även visas på `:focus-visible` och touch — annars är
   åtgärden osynlig för tangentbord och mobil (uiverse-fällan nr 1).
6. Kontrast MÄTS, gissas aldrig. Golv 4.5:1 (3:1 stor text).
7. Inga `-*`-mönster inuti CSS-blockkommentarer (`*/` stänger kommentaren mitt i meningen —
   bröt bygget två gånger i goal-60). PostCSS-parsa ny CSS **innan** build.

## Komponent → yta (kartan)

| uiverse-komponent | Yta i Corevo | Vad vi lånar |
|---|---|---|
| Cart-loader (fallande varor i korg) | Kassans pending-läge, bokningens "bekräftar…" | Rörelse-idén: laddaren berättar VAD som händer. Skalas via `--loader-scale`. |
| "Added to cart!"-toast | Ersätter dagens tunna `.added`-flyout i AddToCart | Kvitto-anatomi: ikon + text + väg vidare, reser sig ur knappen |
| Cart/coupon/checkout-kortsviten | **/varukorg + /kassa** (fortfarande visuellt trasig) | Rad-anatomi, kupong-fältet, totalsummans hierarki |
| Glass-/flip-kort | Mall-galleriet (super-admin) + kundkort | Vändning = "baksidan har mer info" (aldrig dekor) |
| Tooltip/hint-sviten | Admin — där vi idag har **noll** tooltips | Förklaring vid fältet, inte i en manual |
| Kontextmeny-kortet | Admin-radens åtgärder | Destruktiv åtgärd får semantisk hover, inte samma grå som "Ändra" |
| Toggle/checkbox-switchar | Admin-inställningar (moduler på/av, Drift-fliken) | Tillståndet syns från andra sidan rummet |
| Settings-knapp m. snurrande ikon | Admin-headerns inställningar | Ikonen rör sig **för att** något laddar |
| Social-ikonknappar | Storefront-footer | Hover som avslöjar identitet, med focus-paritet |
| Fil-uppladdningskortet | Bild-uppladdning (produkter, logotyp, mall-media) | Drop-zonens tillstånd: idle · dragover · uppladdning · klar |
| Hover-reveal-knappar | Storefront-produktkort ("Snabbvy") | **Kräver focus-paritet** innan de får finnas |

**Förkastat (medvetet):** 3D-roterande karusellen (bryter reduced-motion, tvingar perspective på
scroll-container, funkar inte med tangentbord), moln-/måne-dekoren i dark-toggle (ren dekor),
batteri-/klock-loaders (berättar inget om vår väntan). "Använd brett" ≠ använd allt — Zivar sa
*rätt saker på rätt plats*.

## Faser (Zivars ordning: mallar → super-admin → kund-admin → bokning → FreshCut)

### Fas 1 — MALLAR
**1a. Varukorgen.** ✅ AVSKRIVEN 2026-07-12: defekterna var ALDRIG i koden — den gamla mätningen
gjordes mot en dev-server som gav 404 på all `/_next/static/*` (ostylad HTML-skelett). Efter
server-omstart mäter korgen rent: 0 overflow, 0 klickytor under 44, rad/panel på samma baslinje.
**1b. Toast + loader + payoff.** ✅ KLART (commits 9657e60 + 91624cb): CartToast (kvitto-kort),
CheckoutLoader (varor faller i vagnen under confirmOrder), ritad bekräftelse-bock. Läxa som är
LAG nu: storefront-overlays portaleras till STOREFRONT-ROTEN via `portal-host.ts`, aldrig body —
[data-theme] sitter på skalet, en body-portal faller ur mallens tokens (mätt: guld-ikon bredvid
grön knapp i flora).
**1b½. Svep-verify-maskinen.** ✅ BYGGD: dev-only cookien `corevo-dev-theme` (tenant-data.ts,
död kod i prod) renderar VILKEN mall som helst med riktig tenant-data på alla sidor. Verktyg:
`_diag.mjs` / `_probe.mjs` / `_sweep.mjs` i apps/web. Svep-1 fann: mobil-overflow i 6 mallar
(onyx 256px = footer-ordmärket; wildthistle 59; aurora 50; sage 35 + saknad fokusring; viora 14;
calytrix 6) och nav-länkar 18–28px höga i ALLA 13 (touch-golv 44). Fix-rundan = 13 parallella
agenter, disjunkta filer (wf_e3228ae9).
**1c. Produktkortets hover-lager** (snabbvy — "hjärta" SKIPPAS: ingen wishlist-funktion finns,
och vi klär aldrig en funktion som inte finns) — med focus-paritet. ✅ KLART (v1.14.0).
**1d. Mobil-nav-mönster.** ✅ AVSKRIVEN 2026-07-12 — påståendet var FEL. Mätt med `_mobnav.mjs`
(alla 20 mallar × 390px): hamburgaren + NavShells overlay finns överallt, exakt 1 synlig länk i
headern (ordmärket) i 19 av 20. Calytrix visar 4 — och det är MEDVETET (korg + köp-CTA får inte
försvinna på mobil, står i dess CSS). Ingen bugg. Läxan: mät innan du skriver upp en runda.

**1e. Delade klickytor — de 7 äldre mallarna.** ✅ KLART 2026-07-12 (commit 040ff28).
Florist-sviten var ren för att den äger sina EGNA komponenter; salvia/leander/zigge/linnea/edit/
flora/freshcut använder de DELADE, och de fick aldrig 44px-behandlingen. Mätt (`_old7.mjs`,
7 mallar × 4 sidor, transformer neutraliserade): `navWordmark` 40px · kontaktsidans länkar 20–30px
· footerns sociala 20px · karusellens prickar/paus 24px · shop-titellänk 22px · zigge 7px
mobil-overflow (ett obrytbart tjänstenamn i ett `1fr`-spår som inte kunde krympa).
Fix i den DELADE CSS:en → alla 7 botade i en sväng. Understrykningar flyttade från `border-bottom`
till `::after` (border ritas annars i botten av den nya 44px-boxen, långt under texten).
Efter: **28/28 sida×mall = 0 FAIL**, och de 13 florist-mallarna fortsatt rena (13/13).

**1f. BRANSCH-LAGRET** — Zivars huvudkrav, ✅ KLART 2026-07-12 (commit 040ff28).
"När jag skapar en tatueringsstudio ska det inte stå välkommen till din salong. Branschen avgör
mycket av vad som kommer stå."
Kedjan fanns redan (kundens copy > branschens copy > mallens copy) men `verticals.default_copy`
är TOM i DB → bransch-lagret levererade `{}` → mallens frisörtext läckte till alla branscher.
`components/storefront/bransch-copy.ts` lägger en KOD-DEFAULT under DB-raden (DB vinner så fort
Zivar skriver en rad — kod-defaulten är golvet, inte taket). Frisörtexten som låg hårdkodad i
salvia/leander/zigge/linnea/edit flyttade HEM till frisör-branschen, ordagrant; mallarna är nu
bransch-neutrala men har kvar sin röst. Foton följer samma väg (`BRANSCH_IMAGES`) — floristen
ärver inte längre salongsbilder. Inkopplat på EN punkt (`getTenantBySlug`) → publik storefront
+ salong-preview på en gång.
Städningen: **457 hårdkodade bransch-ord → 58**, och de 58 är sanna (FreshCuts egen text = riktig
frisörkund, schema.org-mappningen `frisör → HairSalon`, CSS-klassnamn). Vakten (`npm run vakt`)
låser nivån: 0 nya tillåtna. `bransch-copy.ts` är undantagen — där ÄR bransch-orden innehållet.

**1g. Sajtbyggaren riven.** ✅ 2026-07-12 (commit 9902204, Zivar: "riv sajtbyggaren").
Spåret var två delar och båda övergivna: look-/render-bron (LOOKS = [] sedan goal-51 → varje
gren onåbar, men `/sajtbyggare-spike/look` svarade **200 PUBLIKT på kundernas domäner** med noll
mallar) och site-content-editorn (flagga på i prod, men ingen meny-ingång, toggeln default av,
bara salvia-mallen). Sida-studion gör allt den gjorde, för alla mallar.
RÄDDAT FÖRST: `manifest/{types,salvia}.ts` → `lib/storefront/skin/` — publika startsidan
importerar salvia-manifestet för content_slots-vägen (`applySkinOverlay`), som INTE är
sajtbyggaren utan bara lånade manifestet. skin-testerna 62/62 gröna FÖRE någon rivning.
RIVET: 4327 rader. `lib/sajtbyggare/**` · spike-rutterna · `/admin/sajtbyggare` · SiteEditor ·
SajtbyggareControl (toggeln i kundkortet) · look-grenarna i `(public)/page+layout` ·
`looks`/`lookKeys` genom hela onboarding-studion · "Designa sidan"-steget i CreateTenantForm ·
`tenantSiteEditorEnabled` + `settings.look` · `SAJTBYGGARE_ENABLED` ur wrangler.
KVAR (medvetet): `MediaRecordSource = 'branding' | 'sajtbyggare'` — ett DB-check-constraint-värde
(migration 0053) som levande actions skriver. Att döpa om det kräver migration.

### Preview-parity (Zivar 2026-07-12: "previewn ska alltid matcha verkligheten")
✅ **Rotorsak 1 FIXAD** (commit ceef05f): tjänste-/personal-/location-/Stripe-actions skrev
tenant-synlig data utan att busta `tenant:<slug>`-taggen — previewn OCH publika sajten visade
gammalt i upp till 300 s (unstable_cache-TTL) trots att iframen laddade om efter spara.
`revalidatePath('/salonger/…')` uppdaterar bara admin-sidans render, ALDRIG datacachen.
Ny helper `revalidateTenantById` + bust i services/people/admin-actions/stripe.
⏳ **Rotorsak 2 KVAR:** previewn kan bara visa Hem/Tjänster/Om/Kontakt (`PREVIEW_PATHS` i
SidaPreviewBridge + `PAGES` i SidaStudio) — modulsidorna (butik/varukorg/kurser/blogg/offert/
presentkort) saknar preview-tvillingar under /salong-preview/<slug>/. Zivar redigerar en butik
han inte kan se. Egen körning: preview-tvillingar för modulsidor + flikar i SidaStudio.
⏳ **KVAR:** verticals-actions bustar ingen tenant (kräver bust av alla branschens tenants).
⏳ **Rotorsak 3 — EDITOR-PARITET PER MALL (Zivar 2026-07-12):** *"varje mall har sina element på
olika ställen … när de ska redigeras får sina element i underflikarna på redigera-sida-delen"* —
Sida-editorns underflikar/fält är byggda kring EN mall-anatomi, men varje mall har egna sektioner
(paisleys countdown-band, calytrix karusell, onyx split-hero …). Kravet: (a) redigera-fälten per
flik ska spegla den AKTIVA mallens element — fält för sektioner mallen inte har ska bort, fält för
mallens egna sektioner ska in; (b) "Visa var"-markeringen (flashText/flashImage i
SidaPreviewBridge) ska fortsätta träffa rätt i varje mall (den matchar text/bild-URL generiskt —
verifiera per mall, särskilt där copy transformeras till versaler via CSS); (c) mall-byte i
editorn → underflikarna ritas om. Trolig väg: varje mall-registry-post (`FLORIST_THEMES` m.fl.)
deklarerar sina redigerbara element (sektion → fält → content-nyckel) och SidaStudio genererar
flikarnas fält ur registryt i stället för en hårdkodad uppsättning. EGEN KÖRNING — planeras efter
runda 2.
Mallarna får komponenterna som **opt-in-anatomi, inte en blank omstilning**: EN delad anatomi med
`--sf-*`-hakar; var och en av de 13 `theme.ts` bestämmer uttrycket. En likformig uiverse-skin över
13 mallar återskapar exakt den skelett-konvergens goal-58 slogs mot.
→ Deploy som vanligt (v*-tagg) så Zivar ser det live.

### Fas 2 — SUPER-ADMIN
Ingen token-indirektion: admin har **ett** utseende → direkta värden i CSS-moduler, samma
sex-lägen-/kontrast-disciplin. Tooltips, kontextmeny på rader, toggles, fil-drop.

### Fas 3 — KUND-ADMIN (booking.corevo.se)
Samma som fas 2. **Under lokalt-först-regeln: commit/push ja, INGEN v*-tagg förrän Zivar säger
"deploy".** Ingen agent taggar mitt i fasen.

### Fas 4 — BOKNINGSFLÖDET (minbooking / boka)

### Fas 5 — FRESHCUT (levande kund, sist)
Minsta möjliga diff. Redan funna brott: closing band 2.73:1 · nav-CTA 2.73:1 · piller-vs-fyrkant-
motsägelsen. Mät före och efter.

## Hård begränsning: admin ändras BARA till utseendet
Mekaniskt kontrollerbart: diffen får röra `className` och CSS — **inga** handlers, ingen state,
ingen DOM-ordning. vitest stannar på 868. 5-agents-rundan byter i admin-faserna ut en lins mot en
**funktionell-identitets-granskare** som läser diffen och fäller allt som rör logik.

## Verifierings-ritualen (varje steg, ingen genväg)
tsc + vitest + `next build` gröna **OCH Playwright öppnar sidan och RÄKNAR** (kontrast, klickytors
storlek, fokusring närvarande). Sessionens värsta fel var *"allt blev grönt och ingen öppnade sidan"*.
Att öppna sidan är ett **steg i listan**, inte en vana man hoppas på.
