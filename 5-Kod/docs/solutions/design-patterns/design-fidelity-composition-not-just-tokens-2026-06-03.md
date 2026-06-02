---
title: "Design fidelity is composition, not just tokens (the elegance gap)"
date: 2026-06-03
category: design-patterns
module: Back-office & storefront UI (Corevo Booking, apps/web)
problem_type: design_pattern
component: frontend_stimulus
severity: high
applies_when:
  - Reskinning or building any back-office, portal, or storefront page against a design mockup
  - A reskin "uses the right colors" but still feels rougher than the reference
  - Reviewing a UI page before declaring it done
  - Onboarding to the Corevo design system (two-worlds, forest/gold vs tenant themes)
tags: [design-fidelity, elegance, back-office, composition, design-tokens, ui-polish, corevo]
---

# Design fidelity is composition, not just tokens (the elegance gap)

> Component note: this project is Next.js/React + CSS Modules, not Rails. The
> schema `component` enum has no React value, so `frontend_stimulus` is used as
> the nearest "frontend view" bucket. Read it as "frontend UI."

## Context

A back-office reskin copied the Corevo design system's colors and primitives
faithfully (forest `#1F4636`, gold `#F5A623`, cream `#FAF8F4`, Playfair + Inter,
the token values) — and the result still read as visibly "rougher" than the
reference design. Zivar flagged it directly: the function was there, the UI was
not at the same level. A 9-agent fidelity audit confirmed the instinct rather
than dismissing it. Verdict, verbatim: **"the atoms are right, the composition
is wrong."** Touched pages scored ~62% fidelity vs the v2 mockups; `/konto`
scored 22% (still a generic un-worlded portal).

The trap: **token-faithful reads as design-faithful to the person who applied
the tokens, but not to the person who knows the design.** Matching the palette
and type scale is necessary and insufficient. The gap is everything that sits
*above* the tokens.

## Guidance

Before declaring any back-office/portal/storefront page done, verify
**composition + signature components + interaction polish**, not just tokens.
The authoritative standard is the **11 elegance tells (T1–T11)** in
`2-Byggplan/DESIGN-ELEGANS-playbook.md` (committed `b38d5c9`). Run its build
checklist per page. The deeper source of truth when the playbook is ambiguous:
`Corevo M6 Build Spec.html` + the v2 prototypes at
`2-Byggplan/corevo-booking-design-system v2/` (both gitignored but kept on disk
— do not delete).

The three layers the audit found missing, in order of impact:

1. **Composition** — multi-column asymmetric grids get flattened to a single
   column. The design uses `1.5fr / 1fr` (or `1.7fr`) left-wider layouts with
   `align-items: start`; rough versions stack everything vertically.
2. **Signature components** — the page-defining custom component is replaced
   with a generic primitive (a flagship swatch/font-tile editor becomes raw
   `<input type=color>` + a text field).
3. **Interaction polish** — no dirty-state workflow, no live preview, no
   movement-on-hover, no self-rendering pickers.

The 11 tells, condensed:

- **T1** Numbers render in Playfair Display + a `.num` tabular class, **not**
  Inter. This is the single biggest rough-tell — Inter numerals instantly look
  like a dashboard template instead of the design.
- **T2** Gold is **accent only**; forest is structure. Gold never becomes a
  fill or a structural surface.
- **T3** Shadows are forest-tinted and layered, never flat black `box-shadow`.
- **T4** Status is muted; the color lives in a 6px dot, not a loud pill fill.
- **T5** Strict type-pairing (Playfair display / Inter body) + an `.eyebrow`
  label over every section.
- **T6** 8px spacing discipline — use the scale
  `{6,7,8,9,10,11,14,16,18,20,22,24,30}`, not arbitrary px.
- **T7** Asymmetric composition: left column wider (`1.5fr`/`1.7fr`),
  `align-items: start` so columns don't stretch to equal height.
- **T8** Separate with hairlines, not boxes-inside-boxes.
- **T9** Calm motion + movement-on-hover (subtle translate/elevation), not
  abrupt color swaps.
- **T10** Let the product tell its story via callout bands (e.g. an inverted
  forest "Röd tråd" card), not bare stat numbers.
- **T11** Self-rendering pickers (a font tile that renders in its own font; a
  swatch that shows the actual color) + live-proof panels that preview the real
  result.

## Why This Matters

Zivar treats elegance as a first-class product goal ("elegance design is
better… land in a nice balance"), not a nice-to-have. A page that works but
looks template-grade undermines a white-label SaaS whose entire pitch is that
each tenant gets a polished, branded surface. And the failure mode is silent:
the implementer who applied the tokens cannot see the gap, because every
individual atom checks out. Only side-by-side-with-the-mockup review, or the
T1–T11 checklist, surfaces it. Skipping that review means shipping ~60%-fidelity
pages that read as done but aren't.

## When to Apply

- Before declaring any UI page done — run the playbook build checklist.
- Whenever a reskin "has the right colors" but feels off — assume composition,
  not tokens, is the gap.
- When a page has a hero/flagship component (Varumärke, dashboard, loyalty),
  build the signature component, not a generic primitive substitute.
- Two-worlds guardrail while applying this: back-office uses Corevo forest+gold;
  storefront/`/konto` uses the tenant's theme (salvia/leander/zigge/linnea/edit)
  and a loyalty numeral in the **tenant accent, never Corevo gold**.

## Examples

**Varumärke (brand) editor — the canonical before/after Zivar flagged:**

Before (rough — atoms right, composition wrong):
- Raw `<input type="color">` blue color pickers
- Free-text font name field
- Flat, static preview block

After (elegant — matches the design):
- Named accent **swatches** (T11 self-rendering — each swatch shows its actual
  color and name)
- A **font-tile picker** where each tile renders in its own font (T11)
- A **live themed storefront preview** that re-renders as you edit (T11
  live-proof panel)
- An **Ångra / Publicera dirty-state workflow** (T9 interaction polish — the
  Publicera button activates only when there are unsaved changes)

**The mental check that catches it:** for each section ask "is this the same
*composition* and the same *signature component* as the mockup, or did I match
the colors and flatten everything else?" If you can't answer without opening the
mockup, open the mockup.

## Related

- `2-Byggplan/DESIGN-ELEGANS-playbook.md` — the 11 tells (T1–T11), signature
  component specs, per-page retrofit delta table, build checklist (authoritative).
- `Corevo M6 Build Spec.html` + `2-Byggplan/corevo-booking-design-system v2/` —
  deeper source of truth (gitignored, on disk).
- Auto-memory: `corevo-design-elegance-standard` (feedback),
  `corevo-backoffice-fidelity` (host model + per-page fidelity scores +
  retrofit roadmap), `corevo-storefront-design-audit`.
