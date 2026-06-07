# CSS — Corevo full styling reference

Everything CSS, for **all** surfaces — not just back-office. Read top to bottom.

## Files (load in this order)

| # | File | Scope | What |
|---|---|---|---|
| 00 | `00-tokens.css` | `:root` + both worlds | **The foundation.** All design tokens + type roles for BOTH worlds, plus the **5 complete storefront themes** (salvia, leander, zigge, linnea, edit). This is the single source of truth for colors/fonts. |
| 01 | `01-backoffice.css` | `[data-world="backoffice"]` | Every back-office component as real CSS classes (sidebar, topbar, command palette, buttons, cards, stat, badges, table, inputs, toggle, drawer, **DetailModal**, sub-tabs, table-chip, quick-action, 7-day week grid, assist banner, toast). Values extracted 1:1 from the prototype. |
| 02 | `02-storefront-customer.css` | `[data-world="storefront"]` | Storefront primitives + the full **customer portal** (Mina sidor) component CSS in the salvia theme. |
| 03 | `03-micro-interactions.css` | both worlds | **Micro-interactions layer.** Tactile button press feedback + gold focus-visible rings, behind `prefers-reduced-motion`. Deliberately avoids `opacity:0` entrance animations — a hidden base state renders BLANK in screenshot/print/hidden contexts and can flash empty. Keep this rule: resting state is always fully visible; only animate on `:active`/`:hover`/`:focus-visible`. |

## The two worlds — the most important rule
There are **two completely separate CSS worlds that must never mix**:

1. **Back-office** — `[data-world="backoffice"]` — the Corevo system look: forest green `#1F4636` + gold `#F5A623` on cream, Playfair Display + Inter. Used by super / salong / frisör.
2. **Storefront** — `[data-world="storefront"][data-theme="…"]` — the salon's **own** public site + the **customer portal**. Per-tenant theme, fully repaintable via tokens. **No Corevo green/gold ever.**

Apply the world (and, for storefront, the theme) on the root of each surface. Loading the tokens does nothing on its own.

## How the themes work
The 5 storefront themes live entirely in `00-tokens.css`. Switching the salon's whole look = changing the `data-theme` attribute (`salvia` / `leander` / `zigge` / `linnea` / `edit`). Each redefines `--color-primary`, `--color-bg`, `--color-fg`, `--font-display`, `--font-body`, `--sf-radius`. The customer portal uses **salvia**. (Zigge is all-caps Bebas Neue and has its own sizing overrides in the tokens file.)

## Branding = runtime tokens, not build-inlined
A tenant's color/font/logo are **runtime `tenant_settings`** — changing them must repaint the storefront with **no deploy**. Implement theme/brand as CSS custom properties set per tenant at runtime, exactly as the token files are structured. Level-3 scoped CSS overrides (premium) are code-only, not no-code.

## Class names vs the prototype
The prototype (`../components/*.jsx`) uses inline CSS-in-JS. These `.css` files re-express that styling as adoptable classes so you can see and reuse the real rules. Use whichever your stack prefers (CSS modules, Tailwind `@apply`, styled-components) — but keep the **exact values** and the **two-world scoping**.

## See also
- `../tokens.json` — the same tokens as structured data.
- `../backoffice-spec.json` — per-screen layout/behavior.
- `../components/` — authoritative source.
