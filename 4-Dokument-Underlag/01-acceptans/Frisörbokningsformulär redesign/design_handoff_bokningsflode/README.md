# Handoff: Booking flow redesign — "FreshCut / Barbershop-editorial"

> **Svensk TL;DR:** Det här är en färdig design‑referens (i HTML) för hela bokningsflödet: alla fyra bokningssätt, bekräftelse på skärm + som mejl, och avboknings­sidan. Ny, djärvare stil. Dokumentet nedan beskriver exakt hur allt ska byggas i den riktiga Next.js‑koden — inklusive hur färgerna ska styras av salongens tema så att varje salong kan sätta sina egna färger i admin (avsnittet **Theming & admin color settings**). Bygg om HTML‑referensen i kodbasen; kopiera inte HTML rakt av.

---

## Overview

This package redesigns the **customer-facing booking experience** for the Corevo booking platform (tenant demo = **FreshCut**, a Linköping barbershop). It covers:

1. **The four booking presentations** — `wizard`, `drawer`, `compact`, `inline` (the exact four ids already in `lib/platform/booking-variant.ts`).
2. **The step flow** — Tjänst → Barberare → Tid → Uppgifter → Bekräftelse (5 steps, unchanged contract).
3. **A new date/time picker** — a month **calendar** _and_ a horizontal **day-strip**, with slots grouped Morgon/Dagtid/Kväll (replaces today's single scroll strip + "välj en dag" empty state).
4. **Staff step with avatars** — three render modes: **foto** (photo), **initialer** (colored monogram disc), **namn** (name only).
5. **On-screen confirmation** — a physical **barber "ticket/stub"** with a stamped BEKRÄFTAD mark.
6. **The confirmation e-mail** — same ticket language, e-mail-safe (inline styles + hex).
7. **The avboka (cancel) page** — full storefront shell + ticket + all outcome states.

The design direction is intentionally bold (the client asked for "en vågad ny look"): **warm cream canvas, espresso ink, a confident burnt-rust accent, a dramatic Caslon serif for headings, a clean grotesque for UI, and IBM Plex Mono for "price-board" meta** (prices, durations, step counters, labels). The rust CTA is the one loud accent; everything else is restrained and editorial.

## About the design files

The files in this bundle are **design references created in HTML** (a single streaming "Design Component" prototype, `FreshCut bokning.dc.html`). They are **not production code to copy directly** — they demonstrate the intended look, layout, copy, and interactions.

Your task is to **recreate these designs inside the existing codebase** (`5-Kod/apps/web`, Next.js 15 App Router + TypeScript, CSS Modules + a global token layer) using its established patterns. The prototype deliberately uses inline styles and a client-only state machine; in the real app the same UI is split across server components, `BookingWizard.tsx`, `booking-global.css`, the notification templates, and the tenant token system. A **component → file map** is given below.

The prototype is one big showroom that lets you toggle every variable (method / mobil-desktop / kalender-dagremsa / foto-initialer-namn) and jump to the e-mail, avboka page, and a side-by-side compare. **The showroom chrome itself is a tool, not part of the product** — ignore the top control bar; build the device-screen contents.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, radii, copy, and interactions are all specified below and present in the prototype. Recreate the UI pixel-close using the codebase's stack. The one thing that is *representative, not final*: staff photos and the hero image are random placeholders (`i.pravatar.cc`, `picsum.photos`) — wire these to real tenant assets (see **Assets**).

---

## For Claude Code — start here (turnkey plan)

**Mission (paste-ready):** “Recreate the booking flow shown in the HTML reference `FreshCut bokning.dc.html` inside our Next.js app (`5-Kod/apps/web`), keeping the existing booking contract. Make every option in the reference — the 4 booking methods, the time picker, the staff-avatar mode, and the colors — **selectable per salon from admin**, stored in `tenant_settings`, with a live preview. Match the visuals pixel-close and drive them from our token system so each salon's colors theme the whole flow.”

**Ground rules**
- Keep the existing contract: `BOOKING_VARIANTS`, `tenant_settings.settings.booking.variant`, `readBookingVariant`/`readBookingMode`, and the server actions `getAvailableSlots`/`createBooking`/`startBookingCheckout`. Do not rename or re-architect them.
- The HTML is a **reference, not code to paste**. Rebuild with our components + CSS Modules + the token layer.
- Style through **tokens only** — never hard-code a salon's colors. Structure/type/radii/ticket motif = fixed; palette + the three option groups = per-tenant.

**Build order (each step ships on its own):**
1. **Tokens** — add the redesign token layer to `packages/ui/tokens.css`, mapped onto the existing contract tokens (see Theming §“What to do”). Confirm the current FreshCut theme still resolves.
2. **Global styles** — restyle `.wizard-*`, `.ckompakt-*`, `.confirm-*` in `booking-global.css` to the new system; add calendar + day-strip + ticket styles. Class names may stay.
3. **`BookingWizard.tsx`** — rebuild steps + compact + step-5 ticket per “Screens/views”; add `pickerMode` and `staffAvatars` props (read from settings); add the calendar picker + grouped slots. No behavior/contract change.
4. **Placement** — update `BookingProvider`/`BookingDrawer` so the four variants render as in “The four presentations” (modal / right drawer / bottom-sheet / inline).
5. **Confirmation route + avboka** — restyle `app/boka/bekraftelse/[id]` and `app/avboka/[id]` to the ticket look + all states.
6. **E-mail** — rebuild `lib/notifications/templates.ts` to the ticket look with inline hex + per-salon accent (Theming §e-mail).
7. **Admin settings page** — build the salon-selectable settings (see “Admin: the salon-selectable settings page”): method, picker, avatars, colors + live preview; write to `tenant_settings`.
8. **Staff photos** — add `staff.avatar_url` + an upload in `admin/personal`; foto mode uses it and falls back to initialer.

**Done when:** all 4 variants render correctly on mobile + desktop; both pickers and all 3 avatar modes work; **every option is changeable in admin and takes effect on the storefront + e-mail with no code change**; changing a salon's primary color re-themes the whole booking UI (and the e-mail accent); existing tests (double-booking, RLS, tenant-resolution) still pass.

---

## Design tokens

All values are CSS custom properties in the prototype. In the app they belong in `packages/ui/tokens.css` (product-fixed values) and the per-tenant override layer (`injectTenantTokens`, see **Theming**).

### Color palette (default "FreshCut" values)

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#211C17` | Primary text; dark surfaces (e-mail top-bar, utility bar, calendar CTA) |
| `--ink-2` | `#6A5F52` | Secondary text, body copy |
| `--ink-3` | `#9E9284` | Muted meta, disabled |
| `--paper` | `#F3EDDF` | Page background (warm cream) |
| `--paper-2` | `#EAE1CF` | Insets, summary bands, footer, browser-chrome |
| `--surface` | `#FDFBF5` | Cards, panels, inputs (near-white warm) |
| `--line` | `#E4DAC6` | Hairline dividers |
| `--line-2` | `#D2C4A9` | Stronger borders (cards, inputs, chips idle) |
| `--rust` | `#BC4A1C` | **Primary accent** — CTAs, selected fills, price text, eyebrows, progress |
| `--rust-deep` | `#9C3D15` | CTA hover / pressed |
| `--rust-soft` | `#F2E0D0` | Tint fill (e.g. "Alla" avatar) |
| `--forest` | `#2E5A46` | Success only (✓ BOKAT / ✓ AVBOKAD) |
| `--forest-soft` | `#E1EBE3` | Success tint (unused-optional) |

Barber monogram disc colors (initialer mode), one per staff for variety: `#BC4A1C`, `#2E5A46`, `#B07A1E`, `#7A4A2E` (assigned round-robin / by id). "Namn" mode uses `--paper-2` bg + `--ink-2` text.

### Typography

Three families (Google Fonts; in-app prefer `next/font` self-hosting):

| Token | Stack | Used for |
|---|---|---|
| `--font-display` | `'Libre Caslon Display', Georgia, serif` | Big questions ("Hos vem?"), brand wordmark, confirmation/avboka H1, e-mail heading |
| `--font-body` | `'Libre Franklin', system-ui, sans-serif` | All UI text, buttons, form fields, body copy |
| `--font-mono` | `'IBM Plex Mono', ui-monospace, monospace` | **Signature detail** — eyebrows, step counter (`3 / 5`), section labels, prices, durations, staff role, ticket meta |

Type scale (px unless noted):
- **Display question** (`wizard-q`): `clamp(26px, 6vw, 34px)`, weight 400, line-height 1.02, letter-spacing −0.01em, `--font-display`.
- **Showroom/page H1** (avboka "Avboka din tid"): `clamp(34px, 6vw, 48px)`, weight 400, `--font-display`.
- **Brand wordmark**: 19–24px `--font-display`.
- **Card title / service name**: 15px, weight 600, `--font-body`.
- **Body / lede**: 14–15px, line-height 1.5–1.6, `--ink-2`.
- **Eyebrow** (mono, rust): 10–11px, weight 600, letter-spacing 0.16–0.22em, UPPERCASE.
- **Section label** (mono): 10px, letter-spacing 0.14em, UPPERCASE, `--ink-3`.
- **Step counter / price / duration / role**: `--font-mono`, 10–15px. Price = 15px weight 600 `--rust`.

### Spacing / radius / borders / motion

- **Spacing**: card padding 13–17px; panel body padding 22px; field gap 14px; grid gaps 7px (slots), 6–9px (chips).
- **Radius**: **0 everywhere** (sharp, editorial — matches FreshCut's square heritage). Exceptions: phone bezel `46px`/screen `34px`, browser frame `12px`, avatar discs/photos `50%`, mobile bottom-sheet top corners `20px`. Do **not** round cards, inputs, buttons, chips.
- **Borders**: `1.5px solid var(--line-2)` for interactive elements; `1px solid var(--line)` for structural dividers; ticket outer border `1.5px solid var(--ink)`; ticket internal dividers `2px dashed var(--line-2)`.
- **Selected states** (important):
  - **Cards** (service, staff): a `2px solid var(--rust)` ring drawn as an inset overlay (`position:absolute; inset:-1.5px`) **plus** for staff a rust circle ✓ badge top-right. Do not fill the card.
  - **Chips / day cells / time slots**: **fill** `background:var(--rust); color:#fff; border-color:var(--rust)`.
  - **Calendar today**: `1.5px solid var(--ink-2)` ring (no fill).
- **Shadows**: panels `0 30–40px 60–80px -20px rgba(0,0,0,.5)`; device frames `0 50px 100px -50px rgba(33,28,23,.45)`; embedded/inline card `0 24px 50px -28px rgba(33,28,23,.35)`. Keep shadows warm/soft, never gold.
- **Motion** (keyframes, ~0.3–0.4s, `cubic-bezier(.2,.9,.3,1)`):
  - step body: `fadeUp` (opacity + translateY 10px) — re-runs per step (mount each step).
  - modal (center, desktop): fade + `translate(-50%,-50%) scale(.97→1)`.
  - modal (mobile): fade + translateY 14px.
  - drawer/compact desktop: slide `translateX(100%→0)`.
  - drawer/compact mobile: bottom-sheet slide `translateY(100%→0)`.
  - scrim: fade to `rgba(23,17,11,.5)` + `backdrop-filter:blur(2px)`.
  - confirmation stamp: `scale(1.5→.9→1) rotate(-9deg)` "BEKRÄFTAD" stamp, delay 0.15s.

---

## The four presentations (exact mapping to `booking-variant.ts`)

The redesign keeps the existing contract **verbatim** — `BOOKING_VARIANTS = ['wizard','compact','drawer','inline']`, persisted at `tenant_settings.settings.booking.variant`, resolved by `readBookingVariant()` / `readBookingMode()`. Two orthogonal axes:

- **Content mode** (`readBookingMode`): `wizard`+`drawer` → **steps** (one decision per screen); `compact`+`inline` → **compact** (everything on one screen).
- **Presentation** (owned by `BookingProvider` / storefront layout):

| Variant | Content | Placement (desktop) | Placement (mobile) | Backdrop |
|---|---|---|---|---|
| `wizard` | steps | centered modal ~470px | near-fullscreen card (14px inset) | dimmed storefront + scrim |
| `drawer` | steps | right slide-over 440px, full height | bottom-sheet (rounded top, ≤92vh) | dimmed storefront + scrim |
| `compact` | compact | right slide-over 440px | bottom-sheet | dimmed storefront + scrim |
| `inline` | compact | in-flow section, no overlay | in-flow section | none — sits in the page, "Boka tid" scrolls to it |

**Implementation note:** the panel markup (header, step body / compact body, action bar, and the confirmation ticket) is **identical across all four**; only the wrapper's position/animation and the presence of the scrim change. In the prototype this is one `panel` element whose style string is computed from `(placement, viewport)`. Mirror that: one `<BookingPanel>` rendered inside a placement wrapper, so all four variants share one code path (matches the current `BookingWizard` `mode` approach).

---

## Screens / views

Copy is **exact Swedish** — reuse verbatim. `{firstName}`, `{email}`, `{ref}` etc. are runtime values.

### Storefront backdrop (shared by all overlay variants + avboka)
- **Utility bar**: full-width `--ink` bg, `--paper` text, centered, mono 10.5px, letter-spacing 0.2em, UPPERCASE: `Drop in eller boka online`.
- **Nav**: `--surface` bg, 1px bottom border. Left: `FreshCut` wordmark (`--font-display` 24px). Right (desktop): `Hem` `Tjänster` `Om oss` `Kontakt` (13.5px, `--ink-2`) + **`Boka tid`** button (`--rust` bg, #fff, 9px 18px, weight 600). Mobile: hamburger (three 2px `--ink` bars).
- **Hero**: 210px (mobile) / 340px (desktop). Full-bleed image + gradient overlay `linear-gradient(180deg, rgba(23,19,14,.28), rgba(23,19,14,.72))`. Bottom-left: mono eyebrow `Barbershop · Linköping` + `--font-display` `clamp(30px,6vw,46px)` "Skarpa klipp, / varm handduk." in `--paper`.

### Booking panel — header
- Overlay variants show a header: `FreshCut` (display 19px) + mono `BOKA TID` label, and a `✕` close button (32px, 1.5px `--line-2` border). Inline shows a `Boka online / Hitta din tid` section header on a `--paper-2` band instead.

### Steps content (wizard / drawer)

**Progress row** (hidden on confirmation): mono step label (`Tjänst`/`Barberare`/`Tid`/`Uppgifter`) left, mono `{step} / 5` right, then 5 equal segments (`height:5px`), filled `--rust` for `i < step`, else `--line`.

**Question heading**: `--font-display`, per step: `Vad vill du ha?` · `Hos vem?` · `När passar det?` · `Dina uppgifter`. Under it, once past step 1, a **recap line** (mono, `--rust`): e.g. `Herrklippning · Första lediga · tors 10:00` (only the parts chosen so far).

- **Step 1 — Tjänst.** Mono category label `Hår & skägg`. Vertical list of service cards: left = name (600) + optional `POPULÄR` tag (mono 9px, rust border) + optional description (`--ink-2` 12.5px); right = mono price (15px, `--rust`) over duration (`--ink-3` 10.5px). Card = `--surface`, `1.5px --line-2`, hover border `--ink`, selected = rust ring overlay.
- **Step 2 — Barberare.** First card **"Alla"** — avatar = `--rust-soft` disc with `✦`, title `Alla`, sub `Vem som helst`, right meta mono `FÖRSTA LEDIGA`; selected shows rust ring + ✓ badge. Then one card per barber: **avatar** (see modes below) + name (600) + mono role `Barberare · 8 år`. Selected = rust ring + ✓ badge.
  - **foto**: circular photo (46px) — real staff avatar.
  - **initialer**: 46px disc, per-staff color, `--font-display` initial in white.
  - **namn**: 46px `--paper-2` disc, `--ink-2` initial (muted) — name-led.
- **Step 3 — Tid.** Two selectable pickers (a per-tenant/admin choice, or expose both):
  - **Kalender**: bordered `--surface` box. Header: `‹` / `Juli 2026` (display 17px) / `›` (prev/next bounded to available months). Weekday row mono `Mån…Sön` (Mon-first). 7-col grid, `aspect-ratio:1` cells, mono numbers. Past days disabled/faded. **Availability dot** (4px, currentColor 0.7) under bookable days. Today = `--ink-2` ring. Selected = rust fill.
  - **Dag-remsa**: horizontal scroll of 60px day chips — mono weekday (uppercase) + `--font-display` date number + mono month. Selected = rust fill.
  - **Slots** below, grouped in sections `Morgon` / `Dagtid` / `Kväll` (mono labels; only non-empty groups shown). 4-col grid of slot buttons: mono time (14px) + (when staff = Alla) small barber name under it. Selected = rust fill. **Empty state**: centered `—` glyph + `Inga lediga tider den dagen. / Prova en annan dag.`
- **Step 4 — Uppgifter.** Summary band (`--paper-2`, 3px left `--rust` border): service name + mono `{time} · {staff} · {duration}` + mono rust price. Then fields, each = mono uppercase label + input (`--surface`, 1.5px `--line-2`, focus border `--rust`): `Namn`, `E-post`, `Telefon`, `Meddelande (valfritt)`.

**Action bar** (sticky bottom, `--surface`, 1px top border): a `←` back button (52px, appears from step 2) + a full-width primary CTA. CTA label = `Fortsätt` (steps 1–3) / `Bekräfta bokning` (step 4). Enabled = `--rust` (hover `--rust-deep`); disabled = `--paper-2` bg / `--ink-3` text. Validation gate per step: step1 service chosen; step2 always ok (defaults to "Alla"); step3 slot chosen; step4 name + valid email (`/.+@.+\..+/`) + phone (≥7 digits).

### Compact content (compact / inline)
Heading `Snabbboka` (display) + lede `Allt på en skärm — för dig som vet vad du vill.` Then mono-labelled rows, all on one scroll:
- `Tjänst` — horizontal chip row (name + mono price). Selected = rust fill.
- `Barberare` — chip row: `Alla` + each barber. Selected = rust fill.
- `Dag` — day chips (same as day-strip). Selected = rust fill.
- `Tid` — 4-col slot grid (same as steps). Empty → `Inga lediga tider den dagen — välj en annan.`
- Two fields side by side: `Namn`, `Telefon`.
- Sticky CTA `Boka tid` with a mono sub-line summary (`{service} · {time}`); disabled hint `Välj tjänst, tid & fyll i namn + telefon`. Ready gate = service + slot + name + phone(≥7).

### Confirmation (in-panel step 5, all variants)
Centered. Mono `✓ BOKAT` (`--forest`). `--font-display` 30px `Vi ses, {firstName}!`. Sub `Din tid är bokad. En bekräftelse är på väg till {email}.` Then the **ticket/stub** (max 330px, `--surface`, `1.5px --ink` border):
- A rotated **"BEKRÄFTAD" stamp** (top-right, `-9deg`, 2px rust border, rust mono, `--surface` bg; stamp-in animation).
- Header row (2px dashed bottom divider): `FreshCut` (display) + mono `{ref}` (e.g. `FC-4827`).
- Grid rows, mono uppercase label + value: `Tjänst`, `Barberare`, `Tid` ({longDate} + mono `kl. {time}`).
- Footer row (2px dashed top divider): mono `Att betala på plats` + mono rust price.
- Buttons: `Lägg till i kalender` (`--ink` bg, `--paper`), `Boka en till tid` (outline → resets flow), text link `Behöver du ändra? Avboka eller boka om` (→ avboka).

### Confirmation e-mail
E-mail-safe (see **Theming → e-mail**). Shown in a mock mail client in the prototype (`Inkorg`, subject, from row, `Svara`/`Vidarebefordra` — those are just the client, not the email).
- **Subject**: `Bokningsbekräftelse — FreshCut`. **From**: `FreshCut <bokning@freshcut.se>`.
- Email card (max 520px, `--paper`, 1px border): 6px `--ink` top bar; `FreshCut` wordmark; mono rust eyebrow `Bokning bekräftad`; display `Vi ses, {firstName}!`; lede `Tack för din bokning. Här är din tid — visa gärna den här biljetten när du kommer.`; the **same stub** (Behandling / Barberare / Tid / Pris (på plats)); a rust button `Avboka eller ändra din tid`; mono note `Du kan avboka senast 24 timmar innan besöket.`; divider; `FreshCut` + `Barbershop · Storgatan 12, Linköping`; small `Drivs av Corevo`.

### Avboka (cancel) page
Full storefront shell (utility bar + nav + footer). Centered section (max 520px): mono rust eyebrow `Din bokning`; display H1 `Avboka din tid`; **stub** (rows Salong / Tjänst / Tid / Hos, 1px dashed dividers). Then outcome state:
- **ready**: `Vill du avboka? Du kan avboka senast 24 timmar innan besöket.` + rust button `Avboka tid`.
- **done**: mono `✓ AVBOKAD` (`--forest`) + `Din tid är avbokad. Varmt välkommen åter när det passar dig!`
- **already**: `Den här tiden är redan avbokad.`
- **too-late**: `Det är för sent att avboka online — ring oss så hjälper vi dig.`
- Link `Till startsidan` (rust underline). Footer: `FreshCut` + mono `Boka tid online · FreshCut`.

*(The prototype adds a small "Testa läge" state switcher — that is a demo affordance, not product.)*

---

## Interactions & behavior

- **No auto-advance** in steps (keep current behavior): selecting only sets state; the bottom-bar CTA advances. Selecting a service/staff/day **resets downstream** choices (slot cleared).
- **Compact / inline** refetch slots whenever service, staff, or day changes; grid disabled/skeleton while loading.
- **Slot collision** (`slot_taken` from `createBooking`): return to the time step, re-fetch, show a non-blocking notice (keep the current `slotTakenNotice` behavior).
- **Payment**: if `payments_enabled && stripe_charges_enabled`, `createBooking` → Stripe Checkout; otherwise land on the ticket ("Att betala på plats"). Preserve the current `startBookingCheckout` path.
- **In-page vs route confirmation**: embedded drawer confirms **in place** (step 5 ticket); the standalone `/boka` route keeps the rich receipt at `/boka/bekraftelse/[id]`. Keep both.
- **Loading/empty/error** states for slots: skeleton chips while pending; empty state (see step 3); error → inline message + "↻ Försök igen".
- **Responsive**: single column on mobile; overlay panels become bottom-sheets ≤92vh with a top gap; inputs never overflow (`min-width:0` on flex/grid children).
- **A11y**: focus-visible ring on inputs (border → `--rust`); real `<button>`/`<label>`; `aria-pressed` on chips; `role="alert"` on notices; time/day groups labelled. Maintain ≥44px touch targets (slots ≥50px, chips ≥44px). Verify rust-on-white text contrast for small text (prefer `--ink` for body; reserve rust for ≥14px semibold + fills).

## State management

Mirror today's `BookingWizard` state (this is the whole machine):
`step (1–5) · serviceId · staffChoice ('any' | staffId) · locationId · date (ISO) · slots[] · slot · form {name,email,phone,note} · pending · error · slotTakenNotice · bookingId · submitted`.
Plus **new**: `pickerMode ('calendar' | 'strip')` and `staffAvatarMode ('foto' | 'initialer' | 'namn')` — either hard-coded product defaults or (better) tenant settings (see Theming). Server data unchanged: services, staff, staff_services, working_hours/locations, availability via `getAvailableSlots`, `createBooking`, `startBookingCheckout` (`app/boka/actions.ts`).

---

## Theming & admin — everything is salon-selectable  ⭐ (the client's key requirement)

**Goal:** everything in the prototype must be **selectable per salon from the admin UI** — the **booking method** (all four: wizard / drawer / compact / inline), the **time picker** (calendar / day-strip), the **staff-avatar mode** (foto / initialer / namn), and the **colors** — with a live preview and no per-salon code changes. The barbershop-editorial *structure* (type, sharp corners, ticket motif, mono meta, layout) stays fixed so every salon looks premium; the **palette and these option groups** are tenant-driven.

### How it already works (reuse this — don't invent a new system)
- `packages/ui/tokens.css` defines contract tokens `--color-primary`, `--color-bg`, `--color-fg`, `--color-accent`, `--font-body`, plus per-theme blocks like `[data-world="storefront"][data-theme="freshcut"]`.
- `injectTenantTokens(branding)` (packages/ui) writes the tenant's chosen values as **inline** custom properties on the storefront root, and **inline wins** over the theme defaults. FreshCut today: `--color-primary:#B59775; --color-bg:#FFFFFF; --color-fg:#252525; …`.
- The booking UI already reads these (`var(--color-accent, var(--color-primary))` for selected fills, `var(--color-primary)` for the CTA, etc. in `booking-global.css`).

### What to do
1. **Re-express the redesign tokens on top of the existing contract tokens**, so they resolve per tenant:
   - `--rust` (accent/CTA/selected) → **`var(--color-accent, var(--color-primary))`**.
   - `--ink` (text/dark surfaces) → **`var(--color-fg)`**; `--ink-2/-3` = `color-mix(in srgb, var(--color-fg) 62%/38%, transparent)`.
   - `--paper` → **`var(--color-bg)`**; `--paper-2` = `color-mix(in srgb, var(--color-fg) 6%, var(--color-bg))`; `--surface` = `var(--color-surface, #fff)`.
   - `--line`/`--line-2` = `color-mix` of `--color-fg` at ~12%/22%.
   - `--rust-deep` = `color-mix(in srgb, var(--rust) 82%, black)`; `--rust-soft` = `color-mix(in srgb, var(--rust) 14%, var(--color-bg))`.
   - Keep `--forest` (success) fixed (semantic, not brand).
   So a salon that sets primary = `#B59775` (FreshCut gold) gets a gold CTA/selection; a salon that sets a deep green gets green — same layout, same ticket, same fonts. Set FreshCut's default primary to the **rust `#BC4A1C`** shown here if they want this exact look, or keep their gold — both work.
2. **Fonts as tokens** (`--font-display`, `--font-body`, `--font-mono`). The redesign's trio (Caslon / Franklin / IBM Plex Mono) is the recommended booking look and can be a product default; if a salon's storefront theme uses different display/body fonts, either inherit them or (recommended) keep the booking surface on the trio for consistency. Make it a token either way so it's swappable, not hard-coded.
3. **Two new booking prefs** — persist alongside the existing `booking.variant` in `tenant_settings.settings.booking`:
   - `pickerMode: 'calendar' | 'strip'` (default `calendar`).
   - `staffAvatars: 'foto' | 'initialer' | 'namn'` (default: `foto` when staff have photos, else `initialer`).
   Read them with the same raw-settings seam as `readBookingVariant` (add `readPickerMode`/`readStaffAvatarMode` in `booking-variant.ts`).

### Admin: the salon-selectable settings page (build this)
One settings surface in **salon admin** (the owner's UI) — e.g. a new `app/(admin)/admin/bokning/page.tsx`, or a “Bokning” tab in `admin/varumarke` — mirrored in **platform admin** `app/(platform)/salonger/[id]`. It writes to `tenant_settings`, and every control shows a **live preview** of the booking panel + ticket (trivial: the tokens/props re-render instantly). The prototype's top control bar (Bokningssätt / Tid-väljare / Barberare / Färger) is literally this settings surface — lift those option groups straight into the admin card.

**Settings schema** (extend, don't replace):

`tenant_settings.settings.booking` (raw jsonb, same read seam as today):
```json
{ "booking": {
    "variant":      "wizard | drawer | compact | inline",   // EXISTING  (default: wizard)
    "pickerMode":   "calendar | strip",                       // NEW       (default: calendar)
    "staffAvatars": "foto | initialer | namn"                 // NEW       (default: foto, else initialer)
} }
```
`tenant_settings.branding` (existing fields, consumed by `injectTenantTokens`): `color_primary` (CTA/selection), `color_accent` (optional), `color_fg` (text), `color_bg` (background) — hex strings.

**Read seams** — alongside `readBookingVariant` in `lib/platform/booking-variant.ts`, add `readPickerMode(settings)` and `readStaffAvatarMode(settings)` (same raw-read + default + legacy tolerance). `app/boka/page.tsx` and the storefront drawer pass all three down to `BookingWizard`.

**Write** — a server action `updateBookingSettings(tenantId, patch)` that merges into `tenant_settings.settings` (follow the existing settings-write pattern in `installningar/Settings.tsx` / the platform tenant actions); the color fields write to `branding` (there's already a branding-write path behind `StorefrontExtrasCard`).

**Controls (each with live preview):**
- **Bokningssätt** — 4 selectable cards (label + one-line description + the mini schematic from the prototype's “Jämför alla” view): *Steg-för-steg (Rekommenderad)* · *Sidopanel (Desktop)* · *Snabbboka (Genväg)* · *Inbäddad (Native)*.
- **Tid-väljare** — segmented control: *Kalender* / *Dag-remsa*.
- **Barberarbilder** — segmented control: *Foto* / *Initialer* / *Namn* (disable *Foto* with a hint when no staff has an `avatar_url`).
- **Färger** — color inputs *Primärfärg* / *Accent* / *Textfärg* / *Bakgrund*; curated swatches + hex entry; use `accentForeground()` (already in `@corevo/ui`) to keep CTA text legible; show a low-contrast warning.

**Platform vs salon split** — platform admin sets the default and may lock any control per plan (same governance already used when Zivar picks `booking.variant` during onboarding); the salon owner edits within those bounds.

### E-mail theming (important nuance)
E-mail clients strip `<link>`, ignore CSS variables and web fonts — so the token approach **cannot** reach the inbox. `lib/notifications/templates.ts` already solves this with an **inline HEX mirror** + a per-salon `accentColor`/`logoUrl`/`slogan`. To ship the new e-mail:
- Redesign `shell()`, `details()` and the senders to the new ticket look **using inline hex** (ink top-bar instead of gold; mono labels via a monospace stack with Georgia/Arial fallbacks — Plex Mono/Caslon will usually NOT render in mail, so choose graceful serif/mono fallbacks and don't depend on them).
- Feed the salon's palette in as hex (map `branding.color_primary` → the accent used for the button/eyebrow; keep `accentForeground()` for the button label). Table-based layout, ≤520px, as today.
- Keep `Drivs av Corevo` in the footer.

---

## Component → file map (target codebase `5-Kod/apps/web`)

| Design piece | File(s) to change |
|---|---|
| Steps / compact content, all 4 variants, state machine, step-5 ticket | `components/booking/BookingWizard.tsx` |
| Global booking visual system (restyle `.wizard-*`, `.ckompakt-*`, `.confirm-*`, add calendar + ticket styles) | `app/booking-global.css` |
| Variant contract (unchanged) + new `pickerMode`/`staffAvatars` readers | `lib/platform/booking-variant.ts` |
| Placement (modal / drawer / compact / inline) + scrim + bottom-sheet | `BookingProvider` / storefront layout, `components/storefront/BookingDrawer.tsx` |
| Standalone confirmation route (rich receipt + `.ics`) | `app/boka/bekraftelse/[id]/page.tsx` |
| Avboka page + outcome states | `app/avboka/[id]/page.tsx` (+ `app/avboka/actions.ts` unchanged) |
| All transactional e-mails (confirmation/cancellation/reminder/receipt) | `lib/notifications/templates.ts` |
| Design tokens + per-tenant theming | `packages/ui/tokens.css`, `injectTenantTokens` (packages/ui), `[data-theme="freshcut"]` |
| Availability / booking server actions (unchanged) | `app/boka/actions.ts`, `app/boka/page.tsx` |
| Admin color/settings box (new) | `app/(admin)/admin/varumarke` (or `installningar`) + `app/(platform)/salonger/[id]` |

---

## Assets

- **Staff photos** (foto mode): prototype uses `https://i.pravatar.cc/160?img=…` placeholders. In production add a `staff.avatar_url` (R2 asset via the existing media pipeline) + an upload field in `admin/personal`; fall back to **initialer** when a staff has no photo.
- **Hero image**: prototype uses `https://picsum.photos/seed/…`. Use the tenant's uploaded hero (already supported via theme content / `image-slot` equivalent).
- **Icons / glyphs**: none are custom art — `✓ ✦ ✕ ← ‹ ›` are plain glyphs; keep or swap for the codebase's icon set (`components/storefront/StorefrontIcon.tsx`).
- **Fonts**: Libre Caslon Display, Libre Franklin, IBM Plex Mono (Google Fonts → self-host via `next/font`).

## Files in this bundle

- `FreshCut bokning.dc.html` — the full interactive design reference (showroom: all 4 variants, both pickers, 3 avatar modes, mobile + desktop, confirmation ticket, e-mail, avboka, compare). Open in a browser. Ignore the top control bar (it's the demo harness).
- `image-slot.js`, `support.js` — runtime deps so the prototype opens standalone.

**Real catalog used in the prototype** (from `supabase/seeds/freshcut-seed.sql`, for realistic reference): Herrklippning 369 kr/30 min · Herrklippning student 329 kr/30 min · Klipp + skägg + varm handduk (långt) 459 kr/45 min · (kort) 419 kr/45 min · Pensionärsklippning 329 kr/30 min · Barnklippning 299 kr/25 min · Skäggtrim 229 kr/15 min. Staff: Hilal, John, Ali, Aziz.
