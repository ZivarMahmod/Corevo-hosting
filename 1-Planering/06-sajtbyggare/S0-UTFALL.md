# S0-UTFALL — Sajtbyggare-spiken (goal-31)

> **Status: GRÖN.** Render-bron håller på riktiga Cloudflare Workers. Motorval avgjort på bevis.
> **Datum:** 2026-06-16 · **Av:** Cowork (Claude), autonom körning · Oberoende live-verifiering av Cowork/Nörden rekommenderas (lita ej på "klart").

---

## 0. Sammanfattning (TL;DR)
Det enda antagande hela sajtbyggaren vilar på — att en **importerad vendor-mall** kan renderas troget på **riktiga Workers/OpenNext-vägen** med en **riktig Corevo-modul invävd vid en markör** — är **bevisat**. En `restoran`-sida renderar troget på en deployad workers.dev-yta med den riktiga `booking`-modulen invävd vid `<corevo-module type="booking">`, med riktig DB-data och **0 console-fel**. Motorvalet är **GrapesJS** (bevis nedan). Wegg-kast-risken är retirerad → S1 kan skrivas.

**Deployad bevis-yta:** `https://bokningsplatformen-staging.zivar68.workers.dev/sajtbyggare-spike/test-barber`
(Editorn: `…/sajtbyggare-spike/editor`.) Bakom `SAJTBYGGARE_ENABLED` — **av i prod, på i staging**.

---

## 1. De fyra frågorna S0 skulle besvara

### Q1 — Håller markör-bron på Workers? **JA.**
- En `restoran`-sida (HTML/CSS/bild) importerad **som data** → renderad på den deployade OpenNext/Workers-vägen (ej localhost).
- Markören `<corevo-module type="booking" pos="reservation">` byts vid render mot den **riktiga** `booking`-modulen via `html-react-parser`. Modulen laddar riktig DB-data server-side (`getWizardServices`) och mountar den riktiga `BookingWizard`.
- **Mekaniskt verifierat** av `5-Kod/scripts/verify_render.mjs` mot den deployade URL:en — **8/8 PASS**:
  HTTP 200 · titel · restoran-hjälte ("Enjoy Our Delicious Meal") · vendor-CSS laddad (`.btn-primary` = restoran-orange `rgb(254,161,22)`) · `[data-corevo-module="booking"]` invävd · 0 föräldralösa markörer · riktig DB-tjänst ("Klippning herr") synlig · **0 console-fel**.
- Skärmdump: `4-Dokument-Underlag/skarmdumpar-bygg/s0-restoran-spike-woven-booking.png`.

### Q2 — GrapesJS vs Puck — vilken är renast? **GrapesJS.** (bevis + motivering i §3)

### Q3 — Per-mall-onboarding-jobbet? **~1,5–2 dagar per mall initialt, ~0,5–1 dag vid mogen tooling.** (§4)

### Q4 — Vendor-JS-beslut? **(c) Statiskt först, React-ifiera rörelse vid behov.** (§5)

---

## 2. F1 — Render-bron (det som byggdes + bevisades)
Tunn vertikal skiva genom hela stacken, bakom flagga:

| Fil | Roll |
|---|---|
| `lib/sajtbyggare/flag.ts` | `SAJTBYGGARE_ENABLED` (call-time-läsning — Workers injicerar vars per request; modul-scope-läsning kan ge `undefined`). Av i prod = noll publik yta. |
| `lib/sajtbyggare/templates/restoran.ts` | `restoran` importerad som data (navbar+hjälte+reservation), asset-paths omskrivna, vendor-JS strippad, reservations-`<form>` ersatt av markören. |
| `lib/sajtbyggare/render-bridge.tsx` | `html-react-parser` — byter `<corevo-module type="X">` mot förladdad modul-nod (**synkront** `replace()`, så modul-data laddas FÖRE parse). |
| `lib/sajtbyggare/booking-mount.tsx` | Server-laddar `getWizardServices` → mountar riktiga `BookingWizard`. Stabil `data-corevo-module="booking"`-markör för verifiering. |
| `app/sajtbyggare-spike/[slug]/page.tsx` | Flagg-gatad, slug-resolvad ruta (utanför `(public)` → host-oberoende, funkar på workers.dev utan tenant-subdomän/cert). |

**Arkitektur-fynd som höll:** modulen är en async server-komponent som vävs in som barn i parser-trädet; `html-react-parser`s synkrona `replace()` placerar bara noden, React resolvar datan vid render. Detta är mönstret S1+ ska återanvända.

---

## 3. F2 — Motor-jämförelse (på bevis)

### 3a. GrapesJS — bevisad round-trip
Headless-harness (GrapesJS **0.23.2**) importerade samma reservations-snippet, redigerade **text + bild**, exporterade:
- `<corevo-module type="booking" pos="reservation">` **överlevde byte-intakt** (både `type` och `pos`).
- Text-redigering ("Reservation" → "Reservera bord") **persisterade** i exporten.
- Bild-redigering (img-`src` bytt) **persisterade**. OBS: bild-src sätts via komponent-modellens `src`-property (i editorn = Asset Manager), INTE via rå `addAttributes` (det reflekterar inte för image-komponenten — ett API-fynd, ej en GrapesJS-begränsning).
- Markören kvar efter BÅDA redigeringarna. (Whitespace normaliserades 529→483 tecken — kosmetiskt.)
- Embedd i appen verifierad: `…/sajtbyggare-spike/editor` bygger + deployar rent (klient-chunk, `dynamic import`, `storageManager:false`).

**Slutsats GrapesJS:** importerar vendor-HTML **troget och billigt** (hela F1-troheten kom gratis ur råa HTML), round-trippar redigeringar, och **bevarar modul-markören** så samma render-bro väver in modulen. Bygger på Backbone.js (därav `backbone-undo`-deprecation-varningarna — ofarliga).

### 3b. Puck/React-konvertering — skiss + bedömning
Puck bygger sidor av **React-block** (JSON-output), importerar **inte** vendor-HTML. Skiss av vägen:

```tsx
// Puck-config: varje mall-sektion blir en React-komponent EN gång (vid import).
const config = {
  components: {
    Hero:    { render: ({ title, img }) => <section className="hero-header">…</section> },
    // Modul-injektion blir TRIVIAL — ingen markör/parser behövs, modulen ÄR ett block:
    BookingModule: { render: () => <BookingMount tenantId={…} slug={…} /> },
  },
}
// data = { content: [ {type:'Hero',props}, {type:'BookingModule'}, … ] }  // lossless JSON
```

**Tradeoff:** Puck gör modul-injektion trivial och round-trip lossless (JSON) — men "exakt Foody/restoran" kräver att **varje mall konverteras till React för hand** (per-mall-kostnaden mångfaldigas över ~100 mallar). GrapesJS får trohet gratis men live-modulen renderas inte *inuti* editor-canvasen (markör-platshållare i editorn, riktig modul vid render).

### 3c. VERDIKT → **GrapesJS**
Den dominerande kostnaden är **trogen import av många vendor-mallar med minimal per-mall-kod** (krav #1 + ~100 mallar). GrapesJS gör exakt det natively (HTML in → redigera → HTML ut, markör bevarad) och matar **samma `html-react-parser`-bro som redan bevisats i F1**. Puck skulle tvinga en React-omskrivning per mall för samma trohet — motsatsen till Zivars regel "använd beprövad OSS, uppfinn inte hjulet".
- **Render-bron (`html-react-parser`) behålls oavsett motor** — den är frikopplad från editorn.
- **S2-arkitektur:** GrapesJS som editor; varje `<corevo-module>` representeras som ett styled platshållar-block + en post i Block Manager (dra-in-modul); äkta WYSIWYG via en iframe som renderar den riktiga storefront-render-vägen (draft).

---

## 4. F3 — Per-mall-onboarding-jobbet (konkret siffra)
Spiken gjorde **en delsida** (subset). Det fulla "INTE noll"-jobbet per mall (spec §2.8), mätt mot vad F1 faktiskt krävde:

| Moment | Tid (första mallarna) |
|---|---|
| Importera alla sidor (restoran ≈ 8: index/about/service/menu/booking/team/testimonial/contact): extrahera, normalisera, skriv om asset-paths | 2–4 h |
| Markera redigerbara regioner + låsa struktur (så kund inte söndrar layout) | 2–3 h |
| Koppla modul-slots + markör-validering | 1–2 h |
| CSS-isolering/scoping (prefixa vendor-CSS under `[data-tenant]` — **reell friktion**, Bootstrap har globala selektorer) | 2–4 h |
| Vendor-JS-hantering (ersätt/droppa carousels & pickers, se §5) | 1–3 h |
| Assets → R2 + optimering | ~1 h (skriptat) |
| Trohets-QA (verify_render + visuellt) | 1–2 h |
| **Summa** | **~10–19 h ≈ 1,5–2,5 dagar/mall** |

Faller till **~4–8 h/mall** när S1:s `import_template.py` + S3:s `validate_markers.mjs` + CSS-prefix-tooling automatiserar det repetitiva. **Förväntan ska kalibreras: "välj mall → klart" är det INTE.**

---

## 5. F4 — Vendor-JS-beslut → **(c) statiskt först, React-ifiera rörelse vid behov**
`restoran` använder jQuery 3.4 + owlcarousel + tempusdominus (datetime-picker) + wow/waypoints/counterup, samt CDN-typsnitt + Font Awesome.
- **Appens CSP blockerar externa CDN-skript** (script-src tillåter inte godtyckliga domäner) → jQuery/owlcarousel/tempusdominus laddas **inte** in i React/Next-sidan. Att ladda godtycklig per-mall-jQuery = hydration-krockar, dubbel-init, versionskrockar (spec §9).
- **Beslut:** S1 renderar mallen **statiskt** (ingen vendor-JS). Interaktiva bitar ersätts av React-ekvivalenter där de behövs:
  - datetime-picker / "Book A Table"-formulär → **redan ersatt** av `BookingWizard` (modulen är den riktiga bokningen).
  - carousels (owlcarousel) → React-carousel eller statiskt grid per sektion.
  - wow/counterup (scroll-animationer) → valfri React-motion senare (ej lastbärande).
- **Konsekvens i spiken:** Font Awesome-ikonen (`<i class="fa">`) och CDN-typsnitt syns ej (faller tillbaka) — kosmetiskt, noteras. Bootstrap+style.css (same-origin) ger layout/färg → trohet håller utan vendor-JS.

---

## 6. F5 — Saneringsgräns (XSS) → **sanera vid SPARANDE, inte per-request på edge**
- Vendor-mallen är **författar-betrodd** (vi importerar den) → ingen runtime-sanering i spiken.
- **Tenant-redigerad HTML** (GrapesJS-export, S2+) MÅSTE saneras innan den persisteras.
- **Var gränsen sitter:** i spar-vägen (server-action vid "Publicera"/"Spara draft"), INTE per render-request.
- **🔴 Kritiskt fynd:** `isomorphic-dompurify`/DOMPurify bygger på **jsdom** och kan **inte köra på Cloudflare Workers edge** (ingen full Node/DOM). Två spår för S2:
  1. Sanera vendor-mallar **offline** vid import (Python BeautifulSoup, per AUTOMATION-scripts.md) — gäller redan betrodda mallar.
  2. Sanera tenant-edits vid spar med en **edge-kompatibel** sanerare (ej jsdom-beroende) — konkret bibliotek är ett S2-utredningsobjekt; kandidat: en allowlist-parser ovanpå `html-react-parser`s egen DOM, eller en WASM/ren-JS-sanerare.
- **Markör-allowlist obligatorisk:** saneraren MÅSTE tillåta `<corevo-module>` + attribut `type`/`pos` (DOMPurify strippar okända taggar by default) annars dödas modul-markörerna.

---

## 7. 🔑 NYCKELFYND (Zivar 2026-06-16) — bokningsmodulen måste vara bransch-medveten
Spiken vävde in **salongs**-varianten av bokningen (tjänst → personal → tid). För en **restaurang** är det fel form — man bokar **bord** (antal personer + datum/tid + önskemål), inte en frisör. `restoran`-mallens egen reservations-form (Namn/E-post · Datum&Tid · Antal personer · Önskemål) **är i princip restaurang-reservations-speccen**.
- **Render-bron är bransch-agnostisk** — den väver in vilken modul markören än pekar på. Detta fynd ändrar INTE bro-beviset.
- **Modul-lagret måste få bransch-varianter:** markören bör välja rätt variant (t.ex. `type="reservation"` restaurang vs `type="booking"` salong), ELLER modulen läser tenantens bransch och anpassar UI + DB-form (bord/antal vs tjänst/personal).
- **Ej byggt i S0** (modul-produktarbete, egen goal). Förs in som #1 i "efter S0".

---

## 8. Rekommendation — hur S1 skrivs
1. **Motor = GrapesJS**, render-bro = `html-react-parser` (behålls). Editorn bakom admin-dörren (`booking.corevo.se /admin/sajtbyggare`).
2. **S1 = trogen import i skala:** `import_template.py` (Python/BeautifulSoup, offline) som tar vendor-mapp → `templates`/`template_pages`-rader + assets→R2 + markerade redigerbara regioner. Mät mot F3-siffran.
3. **Innan S1:** besluta vendor-JS per sektion (§5) och bekräfta CSS-prefix-strategin (F3:s största enskilda friktion).
4. **Parallellt modul-spår (ej sajtbyggaren):** bransch-varianter av bokningen (§7) — restaurang-reservation som första.
5. **Sanering (§6):** utred edge-kompatibel sanerare innan tenant-edits sparas i S2.
6. **Mönstret "deploya → verify_render bevisar"** återanvänds i varje skiva.

---

## 9. Deploy / gates / rollback (för ops)
- **Worker:** `bokningsplatformen-staging` (workers.dev, inga custom domains, `routes:[]` → isolerad). Senaste version-id: **`2bae50dd-cac9-4bd9-8754-a88fc37544bb`**. Rollback-kedja: F2 `90948346` → F1 `82564076` → skelett `6c8adebc`.
- **Prod (`bokningsplatformen`) ORÖRD** — ingen prod-deploy gjord; no-prod-deploy ÄR beviset att POS/FreshCut/de-5-temana är byte-identiska. Verifierat live: `corevo.se` (POS) 200 · `booking.corevo.se/login` 200 + **0 console-fel** (Playwright). `SAJTBYGGARE_ENABLED="false"` i top-level vars (flaggan finns, av).
- **Av-flagga = noll publik yta:** INFERENS (ej direkt observerbar utan förbjuden prod-deploy). Grund: bad-slug → 404 (observerat på staging → `notFound()` renderar korrekt) + prod-var `"false"` ⇒ `=== 'true'` är falskt ⇒ rutan `notFound()`:ar oavsett `undefined`/`false`.
- **Gates gröna före varje push/deploy:** vitest 386/386 · typecheck 0 · lint 0 · opennext build PASS · grep-guard ren (ingen `localhost:3000`). `verify_render` 8/8 mot deployad yta.
- **Bygg:** ENDAST via `C:\tmp\kod` (ö-path kraschar opennext). `.env.local`/`.next`/`.open-next` rensas före bygge (footgun).
- **Commits (main):** F1 `31d06b7` · F2a `1049958` · F6 `e77be45`.

## 10. Städning / data-noteringar
- **test-barber seedad** med spike-fixtures (3 tjänster `category='spike-s0'` + 1 personal + 5 working_hours) så bokningen renderar riktig data. **Rollback-SQL** (kör vid behov):
  ```sql
  delete from working_hours where staff_id='5a17b002-0000-4000-8000-000000000001';
  delete from staff_services where staff_id='5a17b002-0000-4000-8000-000000000001';
  delete from staff where id='5a17b002-0000-4000-8000-000000000001';
  delete from services where tenant_id='11abfb33-3539-4b6b-8932-40bca6a3505e' and category='spike-s0';
  ```
  (test-barber.corevo.se storefront visar nu dessa tjänster — testtenant, ej regression.)
- Skräp-harness `C:\tmp\gjs-roundtrip.html` var en intern testfil (ej i repot). "Foody"-innehållet en testare såg = cachat GrapesJS-projekt i webbläsarens localStorage, ej från harnessen.
