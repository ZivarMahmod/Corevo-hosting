---
name: corevo-design
description: Use this skill to generate well-branded interfaces and assets for Corevo Booking (white-label bokningssystem för salonger), for production or throwaway prototypes/mocks. Contains design guidelines, the two-world color/type system, fonts, the icon set, and clickable UI-kit components for the storefront (5 grundade salongsstilar + inbäddad bokning) and the Corevo back-office.
user-invocable: true
---

Read `README.md` first — it covers the product, the **two separate CSS worlds**
rule (storefront vs back-office — never mix), content + visual foundations,
iconography, and a file index. Then explore the other files.

Key facts to honour:
- **Storefront** = the salon's own site (the product). Editorial, photo-driven,
  per-tenant theme. **Never** the Corevo green/gold here. Five grounded themes
  live in `ui_kits/storefront/` (Salvia / Leander / Zigge / Linnea / Edit), each
  a distinct layout modelled on a real Swedish salon site.
- **Back-office** = Corevo system look (forest `#1F4636` + gold `#F5A623` on
  cream, Playfair + Inter, dark sidebar) in `ui_kits/back-office/`.
- Tokens: `colors_and_type.css` (scoped by `[data-world]`). Icons:
  `ui_kits/icons.jsx` (Lucide-derived). Booking is **embedded**, never an
  external portal; variants in `ui_kits/booking-variants/` + the storefront.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets
out and create static HTML files for the user to view. If working on production
code, copy assets and read the rules here to design as an expert in this brand.

If the user invokes this skill without other guidance, ask what they want to
build or design, ask a few questions, and act as an expert designer who outputs
HTML artifacts _or_ production code, depending on the need.
