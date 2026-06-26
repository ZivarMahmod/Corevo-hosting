<!-- goal-48 W2 build-contract — understand-workflow wf_18c0744d-689, 2026-06-26. Design=LAG anchor for W2. -->

Import graph empirically clean, and `app/(public)/page.tsx:74-102` confirms the real composition order — core `<Layout>` first, then exactly `{shop, offert, blogg, lojalitet, presentkort}` sections appended in that order, each gated by `isModuleLive`. That seals all seven sections. Writing the LAW.

---

# goal-48 W2 — BUILD-CONTRACT (LAW): Onboarding-studio live storefront preview

Scope: replace `PreviewPane`'s inert placeholder with a **real, client-side, live-re-theming storefront render** of the unsaved `StudioCfg`, plus per-bransch module sections. Design=LAG. No fake render. Click-edit hero = W5 (deferred).

**Reader conflict resolved:** Reader C's "the real layouts are SERVER components, port the design mock instead" is **WRONG and must not be re-litigated.** A directive-less module is *universal*, not server-only — imported by a `'use client'` component it compiles into the client bundle. Evidence: `SalviaLayout` is a synchronous pure function (`SalviaLayout.tsx:21`, no `async`), all its interactive children are already `'use client'`-isolated, and C's own description ("synchronous, no I/O, unit-testable via `renderToStaticMarkup`") *is* the definition of a client-safe component. The async/DB-bound things are the module **sections** (`ShopSection` etc.), never the layouts. **Empirically verified:** a full transitive import-graph trace of everything the studio would pull (`STOREFRONT_LAYOUTS` + 5 layouts + `HeroCarousel/Reveal/Gallery/Bookable/BookCta` + `service-format` + `theme-content` + CSS module) found **zero** `server-only` / `next/headers` / `next/cache` / `supabase/server` imports — only `next/navigation`, `next/link`, React hooks, CSS modules. Readers A and B are correct.

---

## 1. MECHANISM

**Chosen path: (a) — render the real `<STOREFRONT_LAYOUTS[cfg.theme]>` directly inside the `'use client'` PreviewPane.** A new small client wrapper `StorefrontPreview` (driven by `cfg`) replaces `<PreviewPlaceholder/>` (`PreviewPane.tsx:159`).

Why (a) over (b)/(c):
- **(b) S2 server-route + iframe is unusable here.** It is keyed by a **saved slug** (`app/sajtbyggare-spike/preview/[slug]/page.tsx:49` `getTenantBySlug`), and S3 onboarding (no tenant) explicitly **suppresses the iframe** for a placeholder (`SiteEditor.tsx:803-825`). The unsaved-cfg case W2 must solve was punted exactly here. Re-parameterizing the route by full cfg adds a server round-trip per keystroke + a 12000-char URL cap (`draft-url.ts:14`) — strictly worse than client render.
- **(a) is the task's mandated path** ("if the real layout can render client-side, do that") and is now build-proven clean.
- **(c) fallback** only if a future transitive import regresses the graph: B's server-route+iframe parameterized by full cfg (POST, not slug). Named, not used.

The layouts are pure props-only render functions (`types.ts:5-14`); their `@/lib/tenant-data` imports are **type-only** (`types.ts:1`, `service-format.ts:1`, `index.ts:2` — `import type`, erased), so the heavy server data layer never loads.

**Theme guard (load-bearing — do NOT skip):** `cfg.theme` is typed `string` (`model.ts:19`); indexing `STOREFRONT_LAYOUTS` with an unknown key → `undefined` → crash. **Do NOT import the runtime guard from `lib/tenant-data.ts`** — that module imports `next/headers` + server Supabase at top (`tenant-data.ts:7-13`), so its runtime exports (`STOREFRONT_THEMES`, `parseTheme`, `DEFAULT_STOREFRONT_THEME`) would poison the client bundle (only `import type` from it is safe). Guard against the **client-safe registry** instead:
```ts
const theme = (cfg.theme in STOREFRONT_LAYOUTS ? cfg.theme : 'leander') as StorefrontTheme
const Layout = STOREFRONT_LAYOUTS[theme]
```
(`'leander'` is the platform default `DEFAULT_STOREFRONT_THEME` value `tenant-data.ts:28`, inlined as a literal to avoid the server import. The 5 keys salvia/leander/zigge/linnea/edit are stable: `tenant-data.ts:26`, `index.ts:22-26`.) Note the design's 6th key "Bohem" has **no real layout** — the guard maps it to the default.

**BookingProvider: do NOT wrap.** Wrapping pulls `BookingDrawer → BookingWizard` into the studio bundle. With no provider, `useBooking()` returns its null default (`BookingProvider.tsx:50-52`) → `BookCta` renders a plain `<Link href="/boka">` (`BookCta.tsx:48-50`) and `Bookable` would `router.push('/boka')` on click (`Bookable.tsx:33`). Both are inert in a preview. Neutralize stray clicks with `pointer-events: none` on the rendered storefront subtree (the preview is display-only in W2; interaction is out of scope).

---

## 2. cfg → LAYOUT PROPS

Build `StorefrontLayoutProps` (`types.ts:5-14`) entirely client-side, re-running on every `cfg` change:

| Prop | Value for unsaved cfg | Source |
|---|---|---|
| `tenant` | `{ id: '', name: cfg.name || 'Din salong', slug: cfg.slug || 'dinsalong' }` | stub; `name` shows only in Salvia "Om {tenant.name}" (`SalviaLayout.tsx:98`) + loc-heading fallback (`:160`), Edit `:80` |
| `theme` | the guarded `StorefrontTheme` (§1) | — |
| `content` | `resolveThemeContent(theme, brandingFromCfg, { tagline: cfg.tagline })` | `theme-content.ts:314` — **pure**, no I/O, type-only imports |
| `services` | `[]` | unsaved → no services. Every layout has an honest empty-state (Salvia `:53/:73-77`, Leander/Zigge/Linnea/Edit likewise) |
| `location` | `null` | only Salvia reads it, with null-fallbacks (`SalviaLayout.tsx:160-200`); others don't destructure it |

**`brandingFromCfg`:** pass `null` (or `{}`). Do **NOT** synthesize `color_*` from `cfg.accent` into branding — accent is applied via `injectTenantTokens` at the wrapper (§3), never through `resolveThemeContent` (`cfg.accent` is not a content field). `team` defaults to `[]` so Salvia's team section self-hides (`theme-content.ts:327-329`, `SalviaLayout.tsx:118`) — correct, no stock faces. `resolveThemeContent` fills full theme-default hero/about/gallery copy + images so the page looks complete with zero owner content.

**Honesty framing (set operator expectation):** with `services=[]`/`team=[]`, the preview shows the theme + **structure** live, not the operator's content. The empty-states ("Tjänster läggs upp inom kort") are correct, not a bug — do not fake sample services.

---

## 3. LIVE RE-THEME (client-side, byte-for-byte the live mechanism)

Wrap the rendered layout + module sections in ONE storefront root:
```tsx
<div
  data-world="storefront"
  data-theme={theme}
  className={storefront.tplRoot}
  style={injectTenantTokens({ color_accent: cfg.accent || undefined })}
>
  {/* preview nav chrome → <Layout …/> → module sections → preview footer */}
</div>
```
- **`data-theme={theme}`** selects the per-theme palette block `[data-world="storefront"][data-theme="…"]` (`packages/ui/tokens.css:190-258`): `--color-primary/-bg/-fg/-line/-accent-soft`, `--font-display/-body`, `--sf-radius`. Changing `cfg.theme` flips the attribute → whole palette recomputes instantly. This stylesheet is global, so the nested wrapper resolves it inside the back-office.
- **`injectTenantTokens({ color_accent })`** (`packages/ui/tokens.ts:51-65`) emits inline `--color-accent` + a recomputed legible `--color-accent-fg`. Inline wins over the `[data-theme]` block (`tokens.css:166-168`). Changing `cfg.accent` re-tints all accent surfaces live.
- **`storefront.tplRoot`** supplies `--nav-h: 116px` etc. (`storefront.module.css:22-28`) — **required** by Salvia's hero (see Risk #1).

**Theme-mask trap (memory: seedad-branding-masks-theme):** inject **ONLY `color_accent`** — never `color_primary/-bg/-fg`. Injecting those inline would mask the `[data-theme]` palette and every theme would "look the same." Accent-only is the trap-dodge.

---

## 4. PER-BRANSCH MODULE SECTIONS

**The real sections (`ShopSection`/`OffertSection`/`BloggSection`/`LojalitetSection`/`PresentkortSection`) CANNOT be reused** — they are `async` SERVER components doing DB I/O (`loadShopData(...)` etc.) keyed by `{ tenantId, slug }`, which an unsaved cfg lacks. So module sections in the preview are **structural mocks — honestly marked**, ported from the design's `moduleBody` renderers (`preview.jsx:393-419`) but **translated to read shared CSS custom props** (`var(--color-primary)`, `var(--font-display)`, …) instead of the design's JS `t` object, so they re-theme *with* the real layout under the same wrapper (§3). This is a translation, not a verbatim port.

**Composition order = the REAL order** (verified `app/(public)/page.tsx:74-102`): core `<Layout/>` first, then sections appended in this exact order — so "append below the layout" is the real composition, not an approximation:

1. `<Layout/>` (real) — covers **booking** via its services rows + Boka CTAs. **Do NOT render a separate booking mock** (would double-render).
2. shop → 3. offert → 4. blogg → 5. lojalitet → 6. presentkort — structural mocks.

**Which cfg state → which section:** gate each with `resolveModuleState(cfg, key, presets)` (`model.ts:70-79`) — this is the client mirror of the server's `isModuleLive`/`isModulePaused` (`page.tsx:63-72`):
- `'live'` → render the structural section mock.
- `'paused'` → render it with a read-only "stängt"-notice (mirrors the real paused contract).
- `'off'`/`'draft'` → section absent.

**BUILT set is hardcoded in the preview** — the real model has no "built" flag (`ModuleOption` = `{key,name,defaultState}` only, `verticals-shared.ts:7-12`). Define a literal `BUILT = {shop, offert, blogg, lojalitet, presentkort}` (booking is in the core layout). This exactly equals the 5 real section components — not coincidence, it's the live storefront's real section set.

**Roadmap modules (`live:false`: portfolio/husdjur/fordon/intag/orderstatus/meny/recurring/deposit/inlamning):** when active, render the design's **dashed "Roadmap" card** (`preview.jsx:410-417`) — the design's own honest stub. Title via the design's `SECTION_TITLES` + bransch eyebrow (`cfg-data.js`, eyebrow per `BRANCHES[cfg.branch].eyebrow`).

**Mitt-konto split (design-faithful, structural):** modules with `defaultPos:"konto"` (husdjur/fordon/intag/orderstatus — `cfg-data.js:142/150/158/177`) render in a separate "inloggad kundportal" panel (`preview.jsx:501-527`), NOT in public main. Since no real konto storefront surface exists yet, mark this panel honestly as a structural/forward-looking preview.

Per-bransch behaviour lives **inside** each mock keyed off `cfg.branch` (e.g. restaurang party-size, tatuering deposit note — `preview.jsx:65-67/89-116`), driven by `cfg.branch` + the bransch terminology overlay (`resolveTerm`/`makeTerm`, `verticals-shared.ts:103-139`) for `staffWord`/`serviceWord`.

---

## 5. FILES (minimal)

**Change:**
- `5-Kod/apps/web/components/platform/onboarding-studio/PreviewPane.tsx` — replace `<PreviewPlaceholder/>` at line 159 with `<StorefrontPreview cfg={cfg} />`. **Keep** the BrowserFrame chrome (`:40-161`) and `live=false` (`:38`) verbatim — still pre-launch, no fake LIVE badge. Delete `PreviewPlaceholder`/`SkelBlock` (`:171-293`).

**Create:**
- `5-Kod/apps/web/components/platform/onboarding-studio/StorefrontPreview.tsx` — `'use client'`. Imports `STOREFRONT_LAYOUTS` (`layouts/index.ts`), `resolveThemeContent` (`theme-content.ts`), `injectTenantTokens` (`@corevo/ui`), `storefront.module.css`, `resolveModuleState` (`model.ts`). Builds props (§2), wrapper (§3), renders preview-nav + `<Layout/>` + module sections (§4) + preview-footer. Holds the `BUILT` literal + `SECTION_TITLES`/eyebrow map ported from `cfg-data.js`.
- `5-Kod/apps/web/components/platform/onboarding-studio/preview-modules.tsx` (optional split) — the structural module-section mocks + dashed roadmap card + konto panel, token-driven. Keep here to keep `StorefrontPreview` lean.
- A unit test (`StorefrontPreview.test.tsx`) asserting: theme guard falls back on unknown key; accent-only injection (no `color_primary`); each `resolveModuleState` outcome → section present/absent/paused; `services=[]` → empty-state, no crash.

**Do NOT touch:** the layouts, `theme-content.ts`, `tokens.*`, the real `*Section` components, the S2 preview route, `model.ts`.

---

## 6. DEFERRED (honest)

- **Click-edit hero/ingress** — the `Editable` contentEditable (`preview.jsx:12-33, 482-483`) = **W5** ("Text & hjälte", `cfg-data.js:319`). W2 renders hero/tagline as **plain themed read-only text**.
- **Spec-mode** `SpecNote` overlays (`preview.jsx:463/477/435/504`) — design teaching aid, omit.
- **Real module data** in sections (live products/posts/config) — needs a saved tenant + DB; W2 uses structural mocks. Real sections light up post-create on the live site.
- **Booking interactivity** in preview (drawer/wizard) — CTAs are inert links; no `BookingProvider`.
- **Real Nav/FooterFull** — server + `currentTenant`-bound (`(public)/layout.tsx:135/145`); preview uses ported structural nav/footer chrome.

---

## 7. RISKS

1. **Salvia hero clip (flagship — verify by screenshot, not eyeball).** `SalviaLayout`'s `.heroSection` pulls the hero up with `margin-top: calc(-1 * var(--nav-h))` (`SalviaLayout.tsx:18-19`) to sit under the live fixed nav. In the preview there is no real fixed nav of `--nav-h: 116px` (`storefront.module.css:28`) → the negative margin clips the hero top by 116px. **Mitigation:** render the preview-nav chrome at exactly `--nav-h` height, OR neutralize the negative margin in the preview wrapper. This is the "känns nära = buggen" trap — confirm with a rendered screenshot of the salvia branch, not by reading.
2. **Theme-mask trap.** Injecting any `color_primary/-bg/-fg` inline masks the `[data-theme]` palette → "every theme looks the same." Inject **only** `color_accent` (§3). (Memory: corevo-storefront-theme-precedence.)
3. **Server-only regression in the import graph.** Today clean (verified), but if a future edit adds a `server-only`/`next/headers` import to any layout or child, the client build breaks. **Gate-zero: `tsc` + `opennextjs-cloudflare build` must pass** (build, not just tsc — `server-only` is a bundler-time guard tsc won't catch). If it ever regresses, fall back to mechanism (c).
4. **Empty-services mistaken for a bug.** `services=[]`/`team=[]` → honest empty-states. Frame preview value as "your theme + structure, live" so empty-states aren't read as breakage. Never fake sample services (no-fake-render law).
5. **`tplRoot` token coupling.** The wrapper MUST carry `className={storefront.tplRoot}` or `--nav-h`/`--sf-radius` are undefined → layout spacing collapses.
6. **Two-CSS-system coherence.** Real layout (CSS modules) + ported module mocks must both consume the **same** `var(--color-*)`/`var(--font-*)` under one `data-world="storefront"` wrapper so they re-theme together — mocks read CSS custom props, never the design's JS `t`.
7. **Performance.** Re-rendering 5 layouts' worth of DOM on every keystroke is fine (synchronous, no I/O), but `Reveal` fades on scroll-into-view (`Reveal.tsx:44-46`) inside the scrollable viewport — acceptable; if distracting, the preview may pass a `reduce`/no-animate flag (not required for W2).

**"Klar" = mechanically 0 FAIL:** `tsc` 0 + `opennext build` pass + the unit test green + a rendered screenshot of the salvia branch showing an un-clipped hero re-theming on accent change. Independent verify (builder does not grade own work).
