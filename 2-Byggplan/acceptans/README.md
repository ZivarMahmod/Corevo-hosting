# Corevo Booking — Design System

White-label **booking SaaS for salons**. Every salon gets its *own* booking
site — own brand, own domain, own tool. Corevo is **not** a marketplace or
network (unlike Bokadirekt / Voady / Wavy, where a salon becomes one listing
among many). The target customer is the salon that wants its own tool on its
own page — never to sit inside someone else's network. There is **no forced
"Corevo" branding toward the end customer.**

> Product language is **Swedish** (the market is Sweden — Linköping salons are
> the benchmark). Storefront copy is in Swedish; this documentation is in
> English for the design team.

---

## ⛔ The single most important rule: TWO SEPARATE CSS WORLDS

Storefront and back-office **never** share style or tokens. The Corevo
dashboard look (green/gold) must **never** leak into the storefront — if it
did, the customer's salon site would look like an admin panel.

| | **STOREFRONT** (World 1) | **BACK-OFFICE** (World 2) |
|---|---|---|
| What | The salon's public site — *the product* | Corevo's owner/operator tools |
| Domains | `demo.corevo.se`, `frisorN.corevo.se` | `booking.corevo.se` |
| Priority | **Highest** — this is what's sold & delivered | Secondary — just clean & functional |
| Look | Editorial, photo-driven, like real Swedish salon sites | Corevo system look |
| Color | **Per-tenant** (salon's own) — sage / lavender / amber… | Forest green `#1F4636` + gold `#F5A623` on cream |
| Type | Per-tenant (Cormorant / Playfair / Bebas…) | Playfair Display + Inter |
| Chrome | Sticky nav, hero, footer | Dark forest sidebar + content |
| Corevo brand | **Never visible** to the end customer | Front and center |

In code: every surface root carries `data-world="storefront"` **or**
`data-world="backoffice"`. Storefront roots additionally carry a
`data-theme="salvia|leander|zigge"` template class. See `colors_and_type.css`.

---

## The layers (every screen is designed & clickable)

1. **Storefront** — customer-facing salon site (per-tenant theme)
   - Home/landing, services, **embedded booking wizard** (opens *in-page*, never
     a redirect), customer account (login, my bookings, profile, reschedule/cancel).
2. **Super admin / platform** (`booking.corevo.se`, Corevo look) — all salons +
   KPIs, salon list & status, onboard new salon, billing.
3. **Salon admin** — the owner (Corevo look) — dashboard, calendar/bookings,
   services, staff, schedules, **branding editor** (logo/color/text → live on
   storefront), Stripe connect, settings.
4. **Staff** — the stylist (Corevo look) — my schedule, today's bookings, absence.
5. *(Optional)* iPad "front-desk view" — big today's-bookings view, stays signed in.

---

## The five storefront templates (distinct, but all grounded in the real references)

A salon must be able to look like a *different brand* from its neighbour —
that's the white-label point. But every template stays inside the same
editorial, photo-driven Swedish-salon design language (studio22 / studioleander
/ zigges). They differ in **palette, type, and mood — not in breaking the
design**. All five are live, clickable themes of the same storefront
(`ui_kits/storefront/`) — switch them from the bottom pill.

| Template | Mood | Accent | Display font | Reference |
|---|---|---|---|---|
| **Studio Salvia** | Airy, minimal, warm paper | Sage `#5E7361` | Cormorant Garamond | studio22.se |
| **Maison Leander** | Romantic, centered | Lavender `#7E6E92` | Playfair Display | studioleander.se |
| **Zigge** | Bold, dark, barber | Amber `#C8743C` | Bebas Neue | zigges.se |
| **Salong Linnea** | Warm, natural Scandinavian | Clay `#B0693F` | DM Serif Display | — |
| **Edit** | Elegant editorial minimal | Charcoal `#3A3733` | Cormorant Garamond | — |

The branding editor drives a per-tenant token contract
(`--color-primary / --color-bg / --color-fg / --font-display / --font-body`),
so a new salon picks a template and fine-tunes color/logo/font on top.

---

## Sources given to the design team

- **`kopia-till-design/DESIGN-BRIEF.md`** — the master brief (deliverables,
  positioning, the two-world rule, all layers/screens, design direction).
- **`kopia-till-design/design-referens-storefront.md`** — storefront reference
  (the editorial "bar", the embedded-booking core requirement, section anatomy).
- **Reference salon sites** (study live — not bundled): studio22.se,
  studioleander.se, zigges.se, kreateamfrisor.se, salongbrannpunkt.se,
  harfixarna.se, mjardeviharcenter.se.
- **Booking-quality benchmarks:** `bokning.voady.se` (the *good* one — clean,
  branded, embedded-quality) vs `book.wavy.nu` (the *anti-pattern* — generic
  external portal; do **not** build like this).
- **No source code or Figma was provided** — these two briefs are the full spec.

> Photography in the mockups uses high-quality Unsplash placeholders standing in
> for tenant-uploaded photos. See **Caveats** at the bottom of this file.

---

## CONTENT FUNDAMENTALS

Product UI language is **Swedish**. Two voices, matching the two worlds.

**Storefront (to the end customer) — warm, calm, personal, "du".**
- Speaks *to* the guest, informal "du": "Boka en stund som är helt din",
  "du sitter i stolen samma dag". Never corporate.
- Short, sensory, editorial. Italic serif accent lines carry warmth:
  *"Varje stol är en stund för sig själv."*
- Eyebrows are an em-dash + topic: "— Tjänster", "— Våra frisörer".
- Service names are plain and concrete: "Klippning dam", "Skägg & rakning",
  "Färg & slingor". Prices "595 kr", "fr. 1 450 kr"; durations "45 min".
- CTAs are short and consistent: **"Boka tid"** everywhere (never "Boka nu!!"),
  "Drop in eller boka online", "Fortsätt", "Bekräfta bokning".
- Closing footer signature: *"Designad med omsorg"*.
- Tone shifts per template voice — Atelier is hushed/elegant, Brass is terse and
  masculine ("Rent snitt. Ingen krångel."), Blom is cheerful ("Ett glatt klipp
  för hela familjen") — but always warm and human.

**Back-office (to the operator) — clear, efficient, calm, "du".**
- Functional and short: "Onboarda salong", "Dagens bokningar", "Anmäl frånvaro",
  "Koppla tjänster", "Ändringar syns direkt på storefronten".
- Friendly greeting on the dashboard: "God morgon, Elin".
- Status words are single, plain: Aktiv · Pausad · Onboarding · Bekräftad ·
  Incheckad · Ny · Godkänd · Väntar.
- Numbers are tabular and unfussy: "6 240", "24 960 kr", "+12% mot förra".

**Casing & punctuation (both):** Sentence case for everything except small
uppercase eyebrows/labels (with wide letter-spacing). Swedish characters å ä ö
throughout. **No emoji** in the storefront or back-office chrome — the one
exception is the playful **Blom** template, where ✦ ✶ ★ are used as decorative
sparkles in keeping with its boutique personality.

## VISUAL FOUNDATIONS

**Two palettes, never mixed.** Storefront = per-tenant (the 5 template accents).
Back-office = Corevo forest `#1F4636` + gold `#F5A623` on cream `#FAF8F4`.
Tokens in `colors_and_type.css`, scoped by `[data-world]`.

**Type.** Back-office: Playfair Display (display/headings) + Inter (UI/body).
Storefront: a display face per template (Cormorant Garamond / Oswald / DM Serif
Display / Archivo / Fredoka) paired with a calm body (Inter / Nunito / Poppins /
Archivo). Big editorial hero sizes (clamp up to ~74px; Bebas/Oswald/Archivo go
larger as they're condensed/heavy). Eyebrows ~11–13px, 0.18–0.32em tracking,
uppercase.

**Spacing.** 8px base scale (`--space-1…11`), with generous editorial section
padding on the storefront (≈90–112px vertical). Whitespace is the primary luxury
signal in Atelier/Maison.

**Backgrounds & imagery.** Storefront is **photo-driven**: full-bleed hero
photography with a top-to-bottom dark protection gradient
(`rgba(0,0,0,.15→.62)`) for legibility — never text on bare photo. Real
salon/hair/barber photography, warm-toned; Kontur converts to grayscale,
Brass desaturates slightly for a moody premium look. Back-office is flat cream
with white cards — no photography in chrome.

**Shape / radius.** Per template: sharp (Atelier, Brass, Kontur 0–4px) vs soft
(Lera 24–32px, Blom 20–24px). Back-office is a consistent medium round: cards
16px, inputs/buttons 10px, pills 999px.

**Elevation / shadows.** Storefront cards lift softly
(`0 24px 60px rgba(0,0,0,.12)`); the booking drawer/sheet uses a strong
directional shadow to read as floating over the page. Back-office uses a 3-step
shadow scale tinted forest (`--shadow-sm/md/lg`) — subtle, never heavy.

**Motion.** Calm and editorial — never bouncy. Standard `--ease-out`
`cubic-bezier(.22,1,.36,1)`, durations 160/280/520ms. Storefront: hero photo
crossfade + slow Ken-Burns scale, scroll-reveal (fade + 28px rise via
IntersectionObserver), service rows indent on hover, drawer slides 520ms.
Back-office: quick 160ms hovers, toggles, progress bars.

**Hover / press.** Hover = darken accent (primary→`-d`) or soft tint fill +
slight indent; press = `scale(0.97)`. Back-office rows tint to `--c-paper-2`.

**Borders.** Hairline `1px` dividers do a lot of work — `--color-line` on the
storefront, `--c-line` on cream. The Edit layout makes bordered grids part of
the aesthetic; Leander uses dotted leaders in the price list.

**Transparency / blur.** Sticky nav goes transparent→`backdrop-filter: blur`
+ hairline once scrolled. Booking scrims use `rgba(0,0,0,.34–.45)` + light blur.

**Layout rules.** Storefront max content width ~1180–1240px, centered, sticky
nav, mobile-first (60–99% mobile). Booking primary action always at the bottom
on mobile (thumb reach). Back-office: fixed 248px dark sidebar + sticky topbar.

## ICONOGRAPHY

- **One icon system, used everywhere:** a **Lucide-derived** inline-SVG set
  (MIT) in `ui_kits/icons.jsx` — thin, consistent **1.75 stroke**, 24×24,
  `currentColor`, rounded caps/joins. One `<Icon name=… size=… stroke=…/>`
  component; ~45 glyphs (calendar, clock, scissors, users, mapPin, palette,
  creditCard, check/checkCircle, chevrons, arrows, etc.). This was a
  **substitution** — no icon set was provided in the brief — chosen because its
  thin, calm line matches the editorial storefront and the clean Corevo
  dashboard equally. Flag to the team if a different set is preferred.
- **No icon font / sprite** — icons are inline SVG paths (sharp at any size,
  themeable via `currentColor`, no extra requests).
- **Emoji:** none in the chrome. Decorative sparkles (✦ ✶ ★) appear *only* in the
  playful **Blom** storefront template, by design.
- **Logos / wordmarks:** rendered as **styled type**, not image files — Corevo is
  the gold "C" tile + wordmark (back-office sidebar); each tenant's wordmark is
  set in its template display font. No raster logos were provided; when a salon
  uploads one, the branding editor's logo slot replaces the wordmark.
- **Map:** live OpenStreetMap embed (inverted via CSS filter on dark themes).

## Index — what's in this design system

**Root**
- `README.md` — this file (context, the two-world rule, content + visual
  foundations, iconography, index).
- `colors_and_type.css` — the token foundation for **both worlds** (scoped by
  `[data-world]`); back-office Corevo palette + the storefront theme contract.
- `SKILL.md` — Agent-Skill manifest (usable in Claude Code).

**UI kits** (`ui_kits/`)
- `icons.jsx` — the shared Lucide-derived icon component (used by every kit).
- `design-canvas.jsx` — pan/zoom canvas starter (powers the two galleries).
- `storefront/` — **the product**: full interactive salon site with five
  grounded, clickable themes (Salvia / Leander / Zigge / Linnea / Edit), each a
  distinct layout (`layouts/`); an embedded 5-step booking drawer; per-tenant
  booking variants (`BookingVariants.jsx`); customer account; plus a
  **`demo.html`** mixer (pick any salon × any booking method).
- `storefront-mobile/` — all five layouts as clickable phone frames, side-by-side.
- `booking-variants/` — **4 booking presentations** on mobile + desktop, with a
  recommendation (Del 2).
- `back-office/` — Corevo dashboards: super admin, salon admin (incl. branding
  editor), staff.

**Other**
- `Corevo-salongsdemo.html` — **standalone** self-contained demo (mix salon ×
  booking method) to show a customer; works offline.
- `slides/` — a short deck presenting the system.
- `preview/` — small specimen cards that populate the Design System tab.
- `screenshots/` — verification captures (working files).

> **Photography** throughout is high-quality Unsplash placeholder, standing in
> for tenant-uploaded photos. See Caveats in the final hand-off note.
