# goal-57 — EN sanning per sak: varukorgs-sida, bransch-mall-text, 100% editor-täckning, design-omtag

Utgår från tre kartläggningar 2026-07-11 (modul-matris, editor/varukorg, mall-katalogen
57 gardener / 58 fruitkha / 66 farmfresh). Svarar på Zivars frågor + plan. Inget byggt än.

---

## Nuläge — svaren

### Modul × bransch (har vi koll? JA)
- Varje modul har fyra lägen: `off / draft / live / paused` (lib/tenant-modules.ts).
  live = publik, paused = synlig men stängd-läge, draft = aktiverad men osynlig, off = aldrig på.
- Bransch-defaults finns PÅ RIKTIGT i DB: `verticals.default_modules` + `default_template`
  + `terminology` — floristen får sitt preset därifrån vid onboarding, aldrig via if(bransch) i kod.
- Publikt gate:as nav-länkar + sektioner + modulsidor konsekvent på state; kundens admin-flikar
  visar "be plattformsadmin aktivera" när off. Kurser hänger på booking-modulen (medvetet).

### Tjänst vs shop-produkt vs kurs — tre olika saker, EN sanning var
| Sak | Tabell | Vad kunden gör | Var den redigeras | Var den syns |
|---|---|---|---|---|
| Tjänst | `services` | BOKAR EN TID (pris + duration) | Tjänster-fliken | /tjanster + bokningsflödet |
| Produkt | `products`+`product_variants` | KÖPER EN VARA (lager, frakt) | Webshop-fliken | /shop + kassan |
| Kurs | `tenant_events` | ANMÄLER SIG (datum, platser) | Kurser-fliken | /kurser |
- Modellerna är helt separata — det ÄR en sanning per sak. Känslan av dubbelhet kommer av att
  floristen kan lägga "Brudbukett" som BÅDE tjänst och produkt; inget hindrar/förklarar det.
- Fix = UX, inte datamodell: en förklarande rad överst i varje admin-flik
  ("Tjänster = sådant man bokar tid för · Butiken = sådant man köper · Kurser = sådant man anmäler sig till")
  + samma trio förklarad i kundkortet. Ingen ny tabell.
- `Kurs:`-prefixade tjänster (gamla) är avaktiverade i live-datat; ingen kodväg skapar dem längre.

### Schema / personal (hur hänger det ihop)
`staff` (vem) × `staff_services` (vem gör vad) × `working_hours` (när, per plats) →
bokningsmotorn räknar lediga tider (`computeSlots`), minus upptagna (`bookings` + `time_off`).
`working_hour_slots` = opt-in exakta starttider som ersätter rastret. Kurser är HELT
frikopplade från denna motor (kapacitet räknas mot `capacity`, inte slots) — korrekt design.

### "apex"
Ingen produkt-funktion — bara host-klassningen i koden: `corevo.se`-roten kallas root/apex och
renderar INGEN storefront (notFound), `boka.corevo.se` naken är reserverad. Inget att åtgärda.

### Bilderna hos floristen
Tema-defaultbilderna är hårdkodade UNSPLASH-stockbilder (theme-content.ts IMG/FLORA_IMG).
Kundens egna uppladdningar vinner alltid (branding.hero_images osv). Floristen kör idag en
blandning. REKOMMENDATION: byt ut stocken mot deras riktiga foton (de har riktiga bilder i
sitt gamla material) — görs i editorn, inget kodjobb. MEN: flora-temat saknar galleri-slot i
editorn (caps-gap, D3 nedan) så tre pelar-bilder går inte att byta idag → kodfix krävs först.

### Varukorgs-buggen (förklarad)
CartDrawer renderas INUTI nav-headern som är `position:fixed; z-index:40` → egen stacking-
context → drawerns z-index 70 gäller bara inne i nav-lagret. Allt på sidan med lager > 40
kan rendera OVANPÅ korgen (det du ser i skärmdumpen). Dessutom: ingen scroll-lock, ingen
Escape, två drawer-instanser (desktop + mobil-overlay). Zivars beslut: korgen ska bli EGEN
SIDA — det raderar hela bugg-klassen i stället för att lappa den.

### "Mallens text" — per-bransch-mall FINNS INTE idag (måste byggas)
Kedjan idag: kundens egen text (`tenant_settings.settings.copy`) → annars TEMATS hårdkodade
text (`THEME_CONTENT` i kod). Ingen nivå däremellan som Zivar äger. `verticals.terminology`
bär bara etiketter (staff/CTA), ingen editorial copy. Zivars krav: "en gång en text → blir
deras mall; jag ska kunna ha en egen mall till nästa florist" = ny nivå i DB.

---

## Körningar

### Körning 11 — Varukorg = egen sida (buggfix genom borttagning)
- Ny `app/(public)/varukorg/page.tsx` i temade skalet — fruitkha-mönstret: produkttabell
  (bild/namn/pris/antal-stepper/ta bort/radtotal) + summeringspanel (delsumma → "Till kassan").
- Bryt ut drawer-kroppen till delad `CartContents`; `CartNavButton` + look-bollen (`CartButton`)
  blir rena `Link href="/varukorg"`; AddToCart-flyouten länkar dit. CartDrawer-skalet bort.
- Tar bort stacking/scroll-lock/dubbelinstans-buggarna helt. Delningsbar URL.

### Körning 12 — Bransch-mall-text (Zivars mall-nivå)
- Utöka `verticals` med `default_copy` jsonb (samma fältkontrakt som CopyOverride) +
  ev. `default_images`. Migration + typer.
- Upplösningskedja: kund-override → **branschens mall (DB, Zivar äger)** → temats default (kod).
  Ändring i `resolveTenantCopy`/`resolveThemeContent`.
- Zivar redigerar mallen i `/branscher/[key]` (VerticalEditor får copy-sektion).
- Editor-chippen får tre lägen: EGEN TEXT / BRANSCHMALLENS TEXT / MALLENS STANDARD.
- Effekt: floristens nuvarande text kan lyftas till florist-branschmallen → nästa florist
  startar med den. FreshCut FREDAD (frisör-branschmall lämnas tom tills önskas).

### Körning 13 — 100% editor-täckning (gap-listan)
Varje synligt element ska vara redigerbart eller medvetet låst — gap funna:
- D1 Flora-pelarna (3 rubriker+brödtexter+länktexter) hårdkodade → in i CopyOverride + editorn.
- D2 Flora ignorerar `closingTitle/closingLede` (hårdkodat "Blommor för din dag?") → wire:a.
- D3 Flora saknar caps (`homeGallery=false` via DEFAULT_CAPS) → pelar/galleri-bilder går inte
  byta i editorn → egen THEME_CAPS-rad för flora + bild-slots.
- D4 Sektions-eyebrows/band-rubriker ("Ur butiken", "Från bloggen", "Presentkort"-bandet,
  "Galleri", "Hitta till butiken") hårdkodade i FloraLayout + delade band-komponenter →
  editerbara fält (per tema-audit: salvia/leander/zigge/linnea/edit också).
- D5 Footer-rubriker/"Designad med omsorg" + utility-strip = medvetet plattforms-låsta —
  dokumentera som LÅST i editorn (liten "låst"-markering), ingen redigering.
- "Visa var"-knapp ska finnas på VARJE fält (finns redan i CopyFieldsCard — nya fält får den gratis).

### Körning 14 — Design-omtag storefront (lånat från mall-katalogen)
Referenser: fruitkha (shop/cart/checkout-flöde, breadcrumb-hero), farmfresh (produktkort med
dubbla runda ikonknappar korg+snabbtitt, grön+orange organisk palett, 45px mjuk kortskugga),
gardener (offert-formulärssektionen quote.html, sektionsrytm med centrerad rubrik + overline).
- Breadcrumb-hero som standard-sidhuvud på alla undersidor (/shop, /kurser, /blogg, /offert,
  /varukorg, /tjanster) — idag hoppar sidorna direkt in i innehåll.
- Produktkort: konsekvent bild-ratio + badge-slot (Nyhet/Säsong) + tydlig korg-knapp.
- Offert-sidan lyfts med gardener-quote-mönstret (centrerat kort på tonad sektion).
- Kurskort efter gardeners service-kort-mönster (ingen av mallarna har events — vi bygger).
- Sektionsrytm: jämn py-rytm + centrerad rubrik m. overline genom hela flora-temat.
- Allt tema-scopat — FreshCut rörs INTE.

### Körning 15 — Innehåll: floristens riktiga bilder
Efter D3: byt Unsplash-stock → deras riktiga foton (hero-trio, pelare, galleri, about).
Kräver bildmaterial från Zivar/floristen — content-jobb i editorn, ej kod.

## Ordning
11 (bugg, minst) → 12 (mall-nivån, störst värde) → 13 (täckning) → 14 (design) → 15 (content).
Varje körning: egen detaljplan före bygge (goal-54-mönstret), tsc/vitest/eslint, deploy m. tag,
FreshCut-verify.

## UTFALL (2026-07-11)

- **Körning 11 KLAR + deployad (v1.7.32, success):** /varukorg egen sida (fruitkha-
  mönster: radlista + summeringspanel), CartDrawer BORTTAGEN (stacking-buggen död),
  CartNavButton/CartButton = rena länkar, AddToCart-flyout → /varukorg.
  Prod-smoke: /varukorg 200, florist 200, freshcut 200.
- **Körning 12 KLAR + deployad (v1.7.33, success):** verticals.default_copy (migration
  0055 applicerad live — CLI-token funkar igen), kedjan kund → bransch → tema
  (layerCopy i getTenantCopy, alla 11 call sites), Sidtext-mall-kort i /branscher/[key]
  (saveVerticalCopy), SidaStudio visar branschmallens text som fältstandard.
  Floristens texter LYFTA till florist-branschmallen (nästa florist ärver dem).
- **Körning 13 KLAR + deployad (v1.7.34, success):** flora 100% redigerbar — pelare
  (3×rubrik/text/länk), banden (Ur butiken/Från bloggen/Presentkort/Galleri/Hitta),
  closing wire:ad till closingTitle/closingLede, flora fick egen THEME_CAPS-rad
  (galleri/pelar-bilder kan nu bytas i editorn). 696 tester gröna varje steg.
- **Körning 14 BYGGD + committad (06d2703) men EJ deployad:** SubpageHero (fruitkha-
  bandet) på /shop /blogg /offert /kurser /varukorg /kassa via pageHero-prop.
  DEPLOY PAUSAD: parallell session bygger goal-58 florist-sviten (13 mallar) i samma
  arbetsträd — tsc rött av deras halvfärdiga filer; taggas när sviten kompilerar.
  OBS kollision: layouts/florist/ raderades först som "orphan" (var deras WIP) —
  återskapad av dem; framtida sessioner: kolla git status för parallellt WIP innan rensning.
- **Körning 15 EJ STARTAD:** kräver floristens riktiga foton (content) + att v1.7.34-
  bildslottarna används i editorn — Zivars/floristens bollplank.
