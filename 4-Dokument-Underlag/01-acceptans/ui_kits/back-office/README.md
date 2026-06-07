# Back-office UI Kit — Corevo system (World 2)

The owner/operator tools. Corevo look: **forest green `#1F4636` + gold
`#F5A623` on cream `#FAF8F4`**, Playfair Display + Inter, dark forest sidebar.
Secondary in priority to the storefront — clean and functional. This look must
**never** leak into the storefront.

Open `index.html`. Use the **role switcher** in the top bar (Super / Salong /
Personal) to move between the three operator surfaces; the sidebar nav swaps to
match.

## Surfaces & screens

**Super admin / plattform** (`booking.corevo.se`)
- Översikt — KPI stats + recent-salons table
- Salonger — searchable/filterable salon cards (status: aktiv/pausad/onboarding)
- Onboarda salong — 4-step wizard (namn & subdomän → temamall (5) → branding → ägare)
- Fakturering — per-salon usage (bookings × per-booking rate)

**Salong-admin** (the owner)
- Dashboard — day/week KPIs, today's bookings, staff-today, Stripe status
- Bokningar — week calendar grid
- Tjänster — service table (price/time/category)
- Personal — staff cards, link services
- Scheman — opening hours editor
- **Varumärke** — branding editor with a **live storefront preview** (logo / accent / display font / hero text → rendered in the *storefront* world, proving the editor drives the salon's own site)
- Inställningar — toggles (customer accounts, SMS reminders, drop-in), Stripe

**Personal** (the stylist)
- Mitt schema — week grid
- Dagens bokningar — today's list, check-in
- Frånvaro — request time off + status

## Files
- `index.html` — entry; role + section routing in `App.jsx`.
- `data.js` — salons, bookings, services, staff, week schedule.
- `Shell.jsx` — `Sidebar`, `Topbar`, and primitives: `Badge`, `Button`, `Card`, `Stat`, `PageHead`, `Table`.
- `SuperAdmin.jsx` · `SalonAdmin.jsx` · `Branding.jsx` · `Staff.jsx` — the screens.

## States demonstrated
Status badges (success/warning/info/gold), hover rows, toggles, multi-step
wizard progress, disabled→enabled buttons, live-updating branding preview.
