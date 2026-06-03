# Storefront UI Kit — the salon's own site (World 1)

**This is the product.** A per-tenant salon site: editorial, photo-driven, with
the **booking wizard embedded in-page** (never a redirect). No Corevo branding
reaches the end customer.

Open `index.html`. The floating **SALONG** switcher (bottom center) swaps
between five grounded demo themes to prove the white-label range — all within
the same editorial, photo-driven salon design language (never breaking it).

## The five themes

| Theme | Mood | Accent | Display font |
|---|---|---|---|
| **Studio Salvia** | Airy minimal, warm paper | Sage `#5E7361` | Cormorant Garamond |
| **Maison Leander** | Romantic, centered | Lavender `#7E6E92` | Playfair Display |
| **Zigge** | Bold, dark, barber | Amber `#C8743C` | Bebas Neue |
| **Salong Linnea** | Warm natural Scandinavian | Clay `#B0693F` | DM Serif Display |
| **Edit** | Elegant editorial minimal | Charcoal `#3A3733` | Cormorant Garamond |

All five read from the same per-tenant token contract
(`--color-primary / --color-bg / --color-fg / --font-display / --font-body`),
so the salon-admin branding editor repaints everything live.

## Files

- `index.html` — entry; loads React + the components below; demo switcher.
- `data.js` — `TENANTS` (3 salons: services, team, hours, copy) + `IMG`
  (Unsplash placeholders standing in for tenant uploads).
- `Chrome.jsx` — `UtilityBar`, `Nav` (sticky, transparent→blur on scroll),
  `Footer`, `Wordmark`.
- `Home.jsx` — `Hero` (photo carousel), `Services` (numbered 01–05 rows),
  `About` (image + italic accent + stat trio), `Team`, `Gallery`,
  `LocationCTA` (hours + OpenStreetMap + closing CTA), plus a `Reveal`
  scroll-in helper.
- `Booking.jsx` — **`BookingWizard`**: the embedded slide-over drawer. 5 steps
  (service → staff → day/time → details → confirmation), keeps the salon brand
  the whole way. The salon page stays visible behind the scrim.
- `Account.jsx` — login / register / "Mina tider" (reschedule, cancel), modal.
- `App.jsx` — assembles a full tenant site + the `ThemeSwitcher`.

## Component states demonstrated

- Nav: transparent at top → frosted + hairline border on scroll; mobile burger → full-screen menu.
- Service rows: hover indent + soft fill.
- Booking: disabled "Fortsätt" until a choice is made; taken time-slots struck through/disabled; success/confirmation receipt.
- Account: login ↔ register tab toggle; "Kommande" booking with Omboka/Avboka.

## Notes
- Maps embed live OpenStreetMap (inverted filter on the dark Zigge theme).
- Photography is placeholder — see root `README.md` → Caveats.
