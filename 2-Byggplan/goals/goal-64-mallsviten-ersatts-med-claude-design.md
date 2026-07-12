# goal-64 — Mallsviten ersätts med Claude Design-paketen

**Status:** PLANERAD — inväntar zip från Zivar. Ingen kod rörd.
**Datum:** 2026-07-12
**Kanon:** `4-Dokument-Underlag/01-acceptans/BRIEF-TILL-CLAUDE-DESIGN.md` (kravspecen som skickades till Design)
**Referensfil (bevisad):** `Ateljé Vinter — Galleri Minimal.dc.html`

---

## 0. Uppdraget, i Zivars ord

> "Byt ut mallarna mot dessa. Bygg dem inte på nytt. De ska äga sin egen design, ingen global grej.
> Ta bort de andra. In i onboarding, i mallvalet, i redigeraren, överallt på rätt sätt.
> Du ändrar inte hur funktionerna fungerar — **mallen styr hur allt ser ut, modulerna följer bara
> och sitter på sin plats och gör vad de ska.** Jag vill inte att det återgår till massa annat."

Två absoluta regler ur detta:

1. **Mallen = LAG.** Live blir en exakt kopia av `.dc.html`-filen. Aldrig "inspirerad av".
   Aldrig re-härleda ett värde som står i filen. (`CLAUDE.md` § DESIGN-TROHET — 18h brann på detta.)
2. **Modulernas funktion rörs inte.** Bokning, shop, köp-räls, kassa, blogg, offert, lojalitet,
   presentkort, kurser: samma DB, samma actions, samma FSM. Mallen byter bara **vy**, aldrig **logik**.

---

## 1. Nuläget — vad som faktiskt finns (verifierat 2026-07-12)

### 21 mallar i `STOREFRONT_THEMES` (`apps/web/lib/tenant-data.ts:35-46`)

| Svit | Mallar | Mapp |
|---|---|---|
| Legacy (7) | `salvia`, `leander`, `zigge`, `linnea`, `edit`, `flora`, `freshcut` | `components/storefront/layouts/` (platt) |
| Florist (13) | `calytrix`, `aurora`, `sage`, `oliviathyme`, `paisley`, `onyx`, `viora`, `isalara`, `seraphina`, `wildthistle`, `mina`, `lunaria`, `eloria` | `layouts/florist/` |
| Ekonomi (1) | `zentum` | `layouts/ekonomi/` |

`DEFAULT_STOREFRONT_THEME = 'leander'` (`tenant-data.ts:47`).

### Kundlåsta — RÖRS INTE

Bekräftat via live-domänerna i `apps/web/wrangler.jsonc:106-108`:

| Domän | Mall | Kund |
|---|---|---|
| `freshcut.corevo.se` | `freshcut` | FreshCut |
| `florist.corevo.se` | `flora` | Hantverksfloristerna |
| `zentum.corevo.se` | `zentum` | Zentum |

⚠️ Detta måste **bekräftas mot DB** innan något raderas (se Steg 0). Supabase-CLI:n är utloggad —
`npx supabase login` krävs i `5-Kod`.

### Var en mall-nyckel nämns (allt måste röras vid borttag)

**Register (8 uppslagsytor):**

| Register | Fil:rad |
|---|---|
| `STOREFRONT_THEMES` (källan till typen `StorefrontTheme`) | `lib/tenant-data.ts:35-46` |
| `STOREFRONT_LAYOUTS` | `components/storefront/layouts/index.ts:23-33` |
| `THEME_OWNS_MODULES` | `layouts/index.ts:43-46` |
| `FLORIST_THEMES` + 6 derivat | `layouts/florist/registry.ts:34,39,41,45,51,57,68` |
| `FLORIST_LAYOUTS`, `themeChrome`, `themePages`, `themeModuleViews` | `layouts/florist/layouts.ts:22,43,48,59-61,69` |
| `THEME_CONTENT` | `components/storefront/theme-content.ts:174-387` |
| `THEME_CAPS` / `THEME_EXTRA_HOME` | `lib/platform/theme-capabilities.ts:29,56` |
| `THEME_PALETTES` / `SELECTABLE_THEMES` | `lib/platform/theme-palettes.ts:75,129` |

**Hårdkodade nycklar utanför registren (måste städas):**
`layout.tsx:142` (salvia, freshcut) · `page.tsx:49-50` (salvia) · `preview-shell.tsx:95` ·
`CreateTenantForm.tsx:48,68,210,857` · `OnboardingStudio.tsx:78` (salvia) ·
`StorefrontPreview.tsx:31` (leander) · `SidaStudio.tsx:237,525` (flora, freshcut) ·
`skin/should-render-db.ts:29` + `skin/salvia-manifest.ts:49` (salvia) ·
`verticals.ts:100` (freshcut) · `packages/ui/tokens.css:190-552` (7 legacy) ·
`globals.css:77,108` · `booking-global.css:514-764` (~50 calytrix-selektorer) ·
`nav-shell.module.css`, `brand.module.css`, `storefront.module.css` ·
`scripts/divergens.mjs`, `scripts/kontrast.mjs`, `scripts/foton-per-mall.json` ·
~15 `_*.mjs` skräpskript i `apps/web/` · migrationer `0026/0028/0030/0038/0040/0041/0050` ·
`supabase/seeds/freshcut-seed.sql` · ~14 testfiler.

### Ytor där en mall syns

| Yta | Fil |
|---|---|
| Mallgalleriet (delas) | `components/platform/ThemeGallery.tsx` — listar ur `THEME_PALETTES`, filtrerar på **kategori** (florist/bokning/ekonomi/kund), inte bransch |
| Kundkortets mallväljare | `components/platform/ThemePicker.tsx` → `setTenantTheme` |
| Onboarding-studion, steg "tema" | `onboarding-studio/StudioPanels.tsx:319` `PanelTema` |
| Live-preview i studion | `onboarding-studio/StorefrontPreview.tsx` |
| Redigeraren | `components/platform/SidaStudio.tsx` |
| Branschens förval | `components/platform/VerticalEditor.tsx` (ur `SELECTABLE_THEMES`) |
| Publika sajten | `app/(public)/**` |
| **Preview-tvillingen** | `app/salong-preview/[slug]/**` — egen kopia av renderkedjan |

---

## 2. 🔴 KONFLIKTEN som måste lösas först

**Bransch-lagret skriver över mallens copy.**

`components/storefront/theme-content.ts:534-537` + `bransch-copy.ts:355-374`:

```
Effektiv precedens per textfält:
  settings.copy (kunden)  >  verticals.default_copy (DB)  >  BRANSCH_COPY (kod)  >  THEME_CONTENT[mall]
                                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                              branschen VINNER över mallen
```

Konkret: Ateljé Vinters hero-copy — *"blommor, betraktade som objekt"* — **ersätts tyst** av
florist-branschens generiska text så fort tenanten har `vertical = florist`. Mallen renderar
då inte sin egen design.

Det är exakt det Zivar säger nej till: *"jag vill inte att det återgår till massa annat."*

### Beslut som krävs (Zivar väljer)

| Alt | Innebörd | Konsekvens |
|---|---|---|
| **A (rekommenderas)** | **Mallen vinner över branschen.** Ny flagga `ownsCopy: true` i mall-manifestet → bransch-lagret hoppas över för den mallen. Kunden (`settings.copy`) vinner fortfarande — det är redigeraren. | Precedensen blir: `kund > mall > bransch`. Designen överlever. Bransch-copy blir vad den var tänkt som: fallback för mallar UTAN egen copy. |
| B | Riv bransch-lagret helt | Enklare, men dödar `bransch-copy.ts` (goal-61, 457 salong-ord → 58). Bransch-copy fyller en riktig funktion för generiska mallar. |
| C | Låt vara | Design-paketen kommer inte att synas. Meningslöst att bygga dem. |

**Rekommendation: A.** Minsta ingrepp, dödar inget befintligt, och den ENDA raden som ändras är
"om mallen äger sin copy, hoppa över bransch-lagret". Modulernas funktion rörs inte.

---

## 3. 🟡 Strukturglapp som måste täppas (annars äger mallen inte "allt")

Ateljé Vinter designar **14 sidor**. Vår motor låter en mall äga bara några av dem idag:

| Sida i .dc.html | Kan mallen äga den idag? | Var den bor |
|---|---|---|
| hem | ✅ | `STOREFRONT_LAYOUTS` |
| nav / footer | ✅ | `ThemeChrome` |
| om / tjänster / kontakt | ✅ | `ThemePages` |
| butik (shop) | ✅ | `ThemeModuleViews.shop` |
| blogg (lista) | ✅ | `ThemeModuleViews.blogg` |
| produktsida | ⚠️ **hårdkodad map** | `app/(public)/shop/[id]/page.tsx:21` `PRODUCT_VIEWS` — bara `calytrix` |
| varukorg | ⚠️ **hårdkodad map** | `app/(public)/varukorg/page.tsx:17` `CART_VIEWS` |
| kassa | ⚠️ **hårdkodad map** | `app/(public)/kassa/page.tsx:19` `CHECKOUT_VIEWS` |
| bekräftelse | ❌ generisk | — |
| kurser | ❌ generisk | `app/(public)/kurser/page.tsx` |
| offert | ❌ generisk | `OffertSection` |
| presentkort | ❌ generisk | `PresentkortSection` |
| lojalitet | ❌ generisk (ingen route) | `StorefrontModuleSections.tsx:68` |
| bloggpost | ❌ generisk | `app/(public)/blogg/[slug]/page.tsx` |
| galleri | ⚠️ sektion i layouten, ingen route | — |

**Åtgärd:** utöka mall-kontraktet `FloristTheme` (`layouts/florist/types.ts:171-208`) med de
saknade vy-slotsen och byt de tre hårdkodade mapparna mot registry-uppslag:

```ts
// layouts/florist/types.ts — utökat ThemeModuleViews
export type ThemeModuleViews = {
  shop?: ComponentType<ThemeShopViewProps>
  blogg?: ComponentType<ThemeBloggViewProps>
  product?: ComponentType<ThemeProductViewProps>       // NY — ersätter PRODUCT_VIEWS
  cart?: ComponentType<ThemeCartViewProps>             // NY — ersätter CART_VIEWS
  checkout?: ComponentType<ThemeCheckoutViewProps>     // NY — ersätter CHECKOUT_VIEWS
  bekraftelse?: ComponentType<ThemeConfirmViewProps>   // NY
  kurser?: ComponentType<ThemeKurserViewProps>         // NY
  offert?: ComponentType<ThemeOffertViewProps>         // NY
  presentkort?: ComponentType<ThemeGiftViewProps>      // NY
  lojalitet?: ComponentType<ThemeLoyaltyViewProps>     // NY
  bloggPost?: ComponentType<ThemeBloggPostViewProps>   // NY
  galleri?: ComponentType<ThemeGalleriViewProps>       // NY
}
```

**Detta ändrar noll funktion.** Varje ny slot är `?` — saknas den faller routen tillbaka på
dagens generiska vy, precis som nu. Server-logiken (data-hämtning, `reserve_shop_order`,
`useCart`/`addLine`, kassans FSM) är oförändrad. Vi flyttar bara **vem som äger JSX:en**.

Utan detta äger mallen sin design överallt utom i kassan och på fyra modulsidor — alltså exakt
den halvglobala smeten Zivar säger nej till.

---

## 4. Transpilerings-kontraktet (.dc.html → tema-paket)

Rent mekanisk mappning. Ingen tolkning, ingen kreativitet.

| `.dc.html` | Vårt paket |
|---|---|
| `<script type="application/json" id="corevo-manifest">` | `<key>.theme.ts` — 1:1, fält för fält |
| `sc-if value="{{ showX }}"` | En route/vy per sida |
| `sc-for list="{{ xs }}" as="x"` | `xs.map(x => …)` |
| `{{ uttryck }}` | `{uttryck}` |
| `onClick="{{ fn }}"` | `onClick={fn}` |
| `style="a:b; c:d"` (inline) | style-objekt, **exakta px/hex** ur filen |
| `style-hover="…"` | CSS-klass i `<key>.module.css` |
| `<helmet><style>` (inkl. media queries) | `<key>.module.css` |
| `DCLogic.state` + `renderVals()` | `useState` + härledda värden i klientkomponent |
| `addToCart(item)` | `useCart().addLine(...)` via `<AddToCart>` — **mallens knapp, vår motor** |
| mock-data (`rawProducts`, `courses`, …) | ersätts av riktig DB-data; formen bevaras |
| `verbatim`-copy | in i `<key>.theme.ts` → `content` (ThemeContentDefaults) |

### Filer per mall (mönstret från calytrix)

```
layouts/<bransch>/<key>.theme.ts        manifestet, 1:1
layouts/<bransch>/<Key>Layout.tsx       hem
layouts/<bransch>/<key>.chrome.tsx      nav + footer
layouts/<bransch>/<key>.pages.tsx       om / tjänster / kontakt
layouts/<bransch>/<key>.modules.tsx     butik + blogg
layouts/<bransch>/<key>.product.tsx     produktsida      (om butik)
layouts/<bransch>/<key>.cart.tsx        varukorg          (om butik)
layouts/<bransch>/<key>.checkout.tsx    kassa             (om butik)
layouts/<bransch>/<key>*.module.css     hover + media queries
```

---

## 5. Exekvering — ordningen

### Steg 0 — Sanning innan förstörelse (BLOCKERANDE)
- `npx supabase login` i `5-Kod` (Zivar kör).
- Kör: `select t.slug, ts.settings->>'theme' from tenants t left join tenant_settings ts on ts.tenant_id=t.id;`
- **Skriv ner exakt vilka mallar som är i bruk.** En mall i bruk raderas ALDRIG.
- Rollback-tagg: `git tag pre-goal-64-<sha>`.

### Steg 1 — Konflikten (§2)
- Zivar väljer A/B/C. Default vid tystnad: **A**.
- Implementera `ownsCopy` i mall-kontraktet + hoppa över bransch-lagret i `resolveTenantCopy`.
- Test som låser det: mall med `ownsCopy` + tenant med `vertical=florist` → mallens hero-copy renderas.

### Steg 2 — Kontraktet (§3)
- Utöka `ThemeModuleViews` + `ThemePages` med de saknade slotsen.
- Byt `PRODUCT_VIEWS` / `CART_VIEWS` / `CHECKOUT_VIEWS` mot `themeModuleViews(theme).product/cart/checkout`.
- Fallback bevarad: saknas sloten → dagens generiska vy. **Noll beteendeförändring för befintliga mallar.**
- Grönt: hela testsviten före ett enda mallbyte.

### Steg 3 — En mall som pilot (Ateljé Vinter)
- Transpilera EN mall hela vägen. Registrera i alla 8 register.
- **Verifiera mekaniskt** (§6). 0 FAIL innan mall nr 2 påbörjas.
- Detta är mönstret som resten kopierar. Går piloten fel, är det kontraktet som är fel — inte mallen.

### Steg 4 — Resten av mallarna
- En i taget. Samma probe. Commit per mall.

### Steg 5 — Rivningen (SIST, aldrig före)
- Ta bort ersatta mallar ur alla 8 register + CSS + `theme-content.ts` + skript + tester.
- `DEFAULT_STOREFRONT_THEME` pekas om (`leander` försvinner ⇒ ny tenant utan mall spricker annars).
- **Kundlåsta mallar (`freshcut`, `flora`, `zentum`) står kvar orörda.**
- Städa `apps/web/_*.mjs` (~15 skräpskript) och `divergens-/kontrast-rapport.json`.
- `supabase/seed-freshcut.sql` (gamla, sätter `salvia`) — död, ta bort.

### Steg 6 — Deploy
- Commit → push main → `v*`-tagg → prod. Enligt stående arbetssätt.

---

## 6. "Klar" = mekaniskt 0 FAIL. Aldrig ögonmått.

| Gate | Hur |
|---|---|
| Registrerad överallt | `florist-suite.test.tsx:81` — mallen måste finnas i `STOREFRONT_LAYOUTS`, `THEME_PALETTES`, `THEME_CAPS`, `FLORIST_THEME_CSS`, `THEME_OWNS_MODULES`. Saknas den → FAIL |
| Renderar utan throw | `renderToStaticMarkup` per mall, `services=[]` ok |
| Modul-gating | Modul av → ingen länk, ingen död route |
| Pausad butik | Inga köp-CTA (`modulvyer.test.tsx`) |
| Inga påhittade priser/länkar | `modulvyer.test.tsx` |
| **Pixel-trohet mot .dc.html** | `probe.js` per mall — hex, px, font-size, spacing ur manifestet. **Detta är gaten som avgör "exakt kopia".** |
| 375 px | 0 horisontell overflow |
| Tap-targets | ≥ 44 px |
| Focus-ring | Synlig på alla interaktiva element |
| Köp-rälsen | E2E: lägg i korg → kassa → order. Oförändrad. |
| **Oberoende verify** | Byggaren rättar inte sin egen läxa (`CLAUDE.md`) |

---

## 7. Risker — namngivna, inte bortförklarade

| Risk | Konsekvens | Motmedel |
|---|---|---|
| Mall saknar manifest-block | Vi tvingas härleda värden ur inline-styles = improvisera = 18h-fällan | **Bygg inte mallen.** Skicka tillbaka till Design. Briefen finns. |
| Mall saknar mobil-brytpunkter | Probe FAIL på overflow; lagar vi det själva improviserar vi | Samma. Kravet står i briefen §3. |
| `DEFAULT_STOREFRONT_THEME` raderas | Varje ny tenant utan vald mall spricker | Steg 5, explicit ompekning |
| Preview-tvillingen glöms | Redigerarens preview visar fel mall än live | `salong-preview/[slug]/**` uppdateras parallellt. OBS: den anropar **inte** `themePages` idag — buggen finns redan |
| Bransch-lagret (§2) lämnas | Designen syns aldrig; allt arbete meningslöst | Steg 1 är blockerande |
| Kundlåst mall raderas | Kund nere | Steg 0 blockerar. DB-sanning före rivning |
| `booking-global.css:514-764` | ~50 calytrix-selektorer globalt = precis den "globala grejen" Zivar inte vill ha | Flytta in i mallens egen `.module.css` vid dess omskrivning |

---

## 8. Vad som INTE ändras (löftet)

- Moduler: bokning, shop, blogg, offert, lojalitet, presentkort, kurser — **samma DB, samma actions, samma FSM.**
- Köp-rälsen: `useCart` / `addLine` / `reserve_shop_order` / kassans FSM — **orörd.**
- Modul på/av per kund: `tenant_modules.state` — **orörd.**
- Onboarding-flödet: samma steg, samma ordning — bara mallistan byts.
- Redigeraren: samma fält-motor (`caps` + `extraHome`) — mallen deklarerar bara sina egna fält.
- Auth, tenant-isolering, `private.tenant_id()`, POS-guardrail — **orörda.**

**Mallen styr formen. Modulen gör sitt jobb och sitter där mallen säger.**
